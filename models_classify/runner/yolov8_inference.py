#!/usr/bin/env python3

import argparse
import os
import re
import signal
import subprocess
import sys
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional

import cv2
from ultralytics import YOLO
import paho.mqtt.client as mqtt

stop = False


def _handle_stop(signum, _frame):
    global stop
    stop = True
    print(f"[yolov8 runner] received signal {signum}, shutting down...", flush=True)


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", required=True, help="Path to model weights.")
    ap.add_argument("--input-width", type=int, default=640)
    ap.add_argument("--input-height", type=int, default=640)
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--model-name", default="YOLOv8")
    ap.add_argument("--model-id", default="")
    ap.add_argument("--cameras", default="", help="Comma-separated camera ids using this model.")
    ap.add_argument("--class-file", default="", help="Path to class names txt file.")
    ap.add_argument("--input-url", default="", help="RTSP/stream URL for inference input.")
    ap.add_argument("--output-url", default="", help="RTSP/stream URL for inference output (overlay).")

    # MQTT 參數
    ap.add_argument("--mqtt-host", default="", help="MQTT broker host (empty to disable MQTT)")
    ap.add_argument("--mqtt-port", type=int, default=1883, help="MQTT broker port")
    ap.add_argument("--mqtt-topic", default="", help="MQTT topic (default: vision/<cameraId>/detections)")
    ap.add_argument("--mqtt-username", default="", help="MQTT username")
    ap.add_argument("--mqtt-password", default="", help="MQTT password")
    ap.add_argument("--mqtt-qos", type=int, default=0, help="MQTT QoS (0/1/2)")

    return ap.parse_args()


def load_class_map(path: str) -> Dict[int, str]:
    """
    解析 YOLO-style 的 names 檔：

    names:
      0: person
      1: bicycle
    """
    class_map: Dict[int, str] = {}
    if not path:
        return class_map
    if not os.path.isfile(path):
        print(f"[yolov8 runner] WARNING: class file not found at {path}", flush=True)
        return class_map

    with open(path, "r", encoding="utf-8") as f:
        in_names_block = False
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.lower() == "names:":
                in_names_block = True
                continue
            if not in_names_block:
                continue
            m = re.match(r"^(\d+)\s*:\s*(.+)$", stripped)
            if not m:
                continue
            class_id = int(m.group(1))
            class_name = m.group(2).strip()
            class_map[class_id] = class_name
    return class_map


def get_class_name(class_map: Dict[int, str], yolo_names: Dict[int, str], class_id: int) -> str:
    """
    優先使用外部 class_map，沒有的話用 YOLO model 裡的 names。
    """
    if class_id in class_map:
        return class_map[class_id]
    if yolo_names and class_id in yolo_names:
        return yolo_names[class_id]
    return f"class_{class_id}"


def log_detections(
    frame_idx: int,
    detections: List[Tuple[int, float, Tuple[int, int, int, int]]],
    class_map: Dict[int, str],
    yolo_names: Dict[int, str],
):
    """
    在終端機列印一行偵測摘要，避免太刷屏。
    """
    if not detections:
        return

    summary = []
    for cls_id, conf, _bbox in detections:
        name = get_class_name(class_map, yolo_names, cls_id)
        summary.append(f"{name}({cls_id}) {conf:.2f}")

    summary_str = ", ".join(summary)
    print(f"[yolov8 runner] frame={frame_idx} detections: {summary_str}", flush=True)


def create_ffmpeg_writer(output_url: str, width: int, height: int, fps: float = 25.0):
    """
    啟動一個 ffmpeg 子行程，從 stdin 接收 BGR raw video，推到 RTSP。
    """
    size_str = f"{width}x{height}"
    fps_value = fps if fps and fps > 0 else 25.0

    cmd = [
        "ffmpeg",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        size_str,
        "-r",
        str(fps_value),
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-tune",
        "zerolatency",
        "-g",
        str(int(fps_value)),
        "-keyint_min",
        str(int(fps_value)),
        "-f",
        "rtsp",
        "-rtsp_transport",
        "tcp",
        output_url,
    ]

    print(f"[yolov8 runner] starting ffmpeg RTSP writer to {output_url} ({size_str}@{fps_value}fps)", flush=True)
    try:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    except FileNotFoundError:
        print("[yolov8 runner] ERROR: ffmpeg not found in PATH, cannot push RTSP output", flush=True)
        return None
    except Exception as e:
        print(f"[yolov8 runner] ERROR: failed to start ffmpeg: {e}", flush=True)
        return None

    return proc


def create_mqtt_client(args, client_id_suffix: str = "") -> Optional[mqtt.Client]:
    """
    建立 MQTT client，連到 broker。
    """
    if not args.mqtt_host:
        print("[yolov8 runner] MQTT disabled (no --mqtt-host provided)", flush=True)
        return None

    client_id = f"yolov8_runner_{args.model_id or 'default'}"
    if client_id_suffix:
        client_id += f"_{client_id_suffix}"

    client = mqtt.Client(client_id=client_id, clean_session=True)

    if args.mqtt_username:
        client.username_pw_set(args.mqtt_username, args.mqtt_password or None)

    try:
        client.connect(args.mqtt_host, args.mqtt_port, keepalive=60)
        client.loop_start()
        print(
            f"[yolov8 runner] MQTT connected to {args.mqtt_host}:{args.mqtt_port}, client_id={client_id}",
            flush=True,
        )
        return client
    except Exception as e:
        print(f"[yolov8 runner] WARNING: failed to connect MQTT broker: {e}", flush=True)
        return None


def publish_detections_mqtt(
    client: Optional[mqtt.Client],
    args,
    camera_id: str,
    frame_idx: int,
    detections: List[Tuple[int, float, Tuple[int, int, int, int]]],
    class_map: Dict[int, str],
    yolo_names: Dict[int, str],
):
    """
    把這一張 frame 的偵測結果丟到 MQTT。

    payload 範例：
    {
      "cameraId": "cam1_raw",
      "modelId": "YOLOv8_V1",
      "modelName": "YOLOv8_V1",
      "frameId": 123,
      "timestamp": "2025-01-30T10:15:00Z",
      "detections": [
        {
          "class_id": 0,
          "class_name": "person",
          "score": 0.94,
          "bbox": [x1, y1, x2, y2]
        },
        ...
      ]
    }
    """
    if client is None:
        return
    if not detections:
        # 若你也想送「空偵測」，這行拿掉即可
        return

    det_list = []
    for cls_id, conf, (x1, y1, x2, y2) in detections:
        label = get_class_name(class_map, yolo_names, cls_id)
        det_list.append(
            {
                "class_id": cls_id,
                "class_name": label,
                "score": conf,
                "bbox": [x1, y1, x2, y2],
            }
        )

    ts = datetime.utcnow().isoformat(timespec="milliseconds") + "Z"

    payload = {
        "cameraId": camera_id,
        "modelId": args.model_id,
        "modelName": args.model_name,
        "frameId": frame_idx,
        "timestamp": ts,
        "detections": det_list,
    }

    topic = args.mqtt_topic or f"vision/{camera_id}/detections"

    try:
        client.publish(topic, json.dumps(payload), qos=args.mqtt_qos, retain=False)
        # 需要 debug 時可以打開：
        # print(f"[yolov8 runner] MQTT publish to {topic}: {len(det_list)} boxes", flush=True)
    except Exception as e:
        print(f"[yolov8 runner] WARNING: failed to publish MQTT message: {e}", flush=True)


def run_stream(
    args,
    model: YOLO,
    class_map: Dict[int, str],
    mqtt_client: Optional[mqtt.Client],
    camera_id: str,
) -> int:
    global stop

    # 嘗試用 class_map，否則用 model.names
    try:
        yolo_names = model.names if hasattr(model, "names") else {}
    except Exception:
        yolo_names = {}

    # 來源：RTSP / HTTP / 檔案 / 本機攝影機
    src = args.input_url if args.input_url else 0

    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"[yolov8 runner] ERROR: failed to open input source: {src}", flush=True)
        return 1

    # 解析輸入的尺寸與 FPS
    in_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or args.input_width
    in_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or args.input_height
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 1 or fps > 120:
        fps = 25.0

    print(
        f"[yolov8 runner] inference loop started, source={src}, size={in_w}x{in_h}, fps≈{fps:.1f}",
        flush=True,
    )

    ffmpeg_proc = None    # RTSP overlay
    if args.output_url:
        ffmpeg_proc = create_ffmpeg_writer(args.output_url, in_w, in_h, fps)

    frame_idx = 0
    next_fps_log = time.time() + 10
    last_time = time.time()
    fps_count = 0

    while not stop:
        ret, frame = cap.read()
        if not ret:
            print("[yolov8 runner] WARNING: failed to read frame, retry after 0.5s", flush=True)
            time.sleep(0.5)
            continue

        frame_idx += 1
        fps_count += 1

        # 若來源解析度與 ffmpeg 設定不同，強制 resize
        if frame.shape[1] != in_w or frame.shape[0] != in_h:
            frame = cv2.resize(frame, (in_w, in_h))

        # Ultralytics 推論
        results = model(
            frame,
            imgsz=(args.input_width, args.input_height),
            device=args.device,
            verbose=False,
        )

        result = results[0]
        detections: List[Tuple[int, float, Tuple[int, int, int, int]]] = []

        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                # xyxy 座標
                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = [int(v) for v in xyxy]
                # 類別 / 信心度
                cls_id = int(box.cls[0].item()) if hasattr(box, "cls") else -1
                conf = float(box.conf[0].item()) if hasattr(box, "conf") else 0.0

                detections.append((cls_id, conf, (x1, y1, x2, y2)))

                # 畫框 + label
                label = get_class_name(class_map, yolo_names, cls_id)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(
                    frame,
                    f"{label} {conf:.2f}",
                    (x1, max(y1 - 5, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0),
                    1,
                    cv2.LINE_AA,
                )

        # log
        log_detections(frame_idx, detections, class_map, yolo_names)

        # 丟到 MQTT
        publish_detections_mqtt(
            mqtt_client,
            args,
            camera_id,
            frame_idx,
            detections,
            class_map,
            yolo_names,
        )

        # 推到 RTSP (ffmpeg)
        if ffmpeg_proc is not None and ffmpeg_proc.stdin:
            try:
                ffmpeg_proc.stdin.write(frame.tobytes())
            except BrokenPipeError:
                print("[yolov8 runner] ERROR: ffmpeg pipe is broken, stop sending frames", flush=True)
                ffmpeg_proc = None
            except Exception as e:
                print(f"[yolov8 runner] ERROR: failed to write frame to ffmpeg: {e}", flush=True)
                ffmpeg_proc = None

        # FPS log
        now = time.time()
        if now >= next_fps_log:
            elapsed = now - last_time
            fps_measured = fps_count / elapsed if elapsed > 0 else 0.0
            print(f"[yolov8 runner] ~FPS: {fps_measured:.2f}", flush=True)
            last_time = now
            fps_count = 0
            next_fps_log = now + 10

        # 若你想在有螢幕的環境看畫面，可以把這段打開：
        # if os.environ.get("YOLOV8_SHOW_WINDOW", "0") == "1":
        #     cv2.imshow("YOLOv8", frame)
        #     if cv2.waitKey(1) & 0xFF == ord("q"):
        #         break

    cap.release()
    cv2.destroyAllWindows()

    if ffmpeg_proc is not None:
        try:
            ffmpeg_proc.stdin.close()
        except Exception:
            pass
        ffmpeg_proc.terminate()
        try:
            ffmpeg_proc.wait(timeout=2)
        except Exception:
            ffmpeg_proc.kill()

    print("[yolov8 runner] inference loop stopped", flush=True)
    return 0


def main():
    args = parse_args()

    signal.signal(signal.SIGTERM, _handle_stop)
    signal.signal(signal.SIGINT, _handle_stop)

    class_map = load_class_map(args.class_file)
    if class_map:
        print(f"[yolov8 runner] loaded {len(class_map)} classes from {args.class_file}", flush=True)

    cameras = [c for c in args.cameras.split(",") if c] if args.cameras else []
    primary_camera = cameras[0] if cameras else ""

    cam_info = ", ".join(cameras) if cameras else "none listed"

    print(
        "[yolov8 runner] starting",
        f"model_name={args.model_name}",
        f"model_id={args.model_id or 'n/a'}",
        f"weights={args.weights}",
        f"input_size={args.input_width}x{args.input_height}",
        f"device={args.device}",
        f"class_file={args.class_file or 'n/a'}",
        f"input_url={args.input_url or 'n/a'}",
        f"output_url={args.output_url or 'n/a'}",
        f"mqtt_host={args.mqtt_host or 'n/a'}",
        f"mqtt_topic={args.mqtt_topic or 'auto'}",
        f"cameras={cam_info}",
        flush=True,
    )

    if not os.path.isfile(args.weights):
        print(f"[yolov8 runner] WARNING: weights file not found at {args.weights}", flush=True)

    # 載入 Ultralytics YOLO 模型
    print(f"[yolov8 runner] loading YOLO model from {args.weights} ...", flush=True)
    model = YOLO(args.weights)

    # 設定 device（cpu / cuda:0 ...）
    try:
        model.to(args.device)
    except Exception as e:
        print(f"[yolov8 runner] WARNING: failed to move model to device={args.device}, error={e}", flush=True)

    # 建立 MQTT client
    mqtt_client = create_mqtt_client(args, client_id_suffix=primary_camera)

    ret = run_stream(args, model, class_map, mqtt_client, primary_camera)

    if mqtt_client is not None:
        try:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        except Exception:
            pass

    print("[yolov8 runner] stopped", flush=True)
    return ret


if __name__ == "__main__":
    sys.exit(main())
