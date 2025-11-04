#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import os
import subprocess
import signal
import sys
import time
import cv2 
import numpy as np

def draw_overlay(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (int(0.1*w), int(0.1*h)), (int(0.4*w), int(0.4*h)), (0, 255, 0), 2)
    cv2.putText(frame, "Action: carry 0.91", (int(0.1*w), int(0.09*h)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2, cv2.LINE_AA)
    return frame

def build_ffmpeg_proc(out_url: str, w: int, h: int, fps: int, hwaccel: str, vaapi_device: str) -> subprocess.Popen:
    cmd = [
        "ffmpeg", "-re",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
    ]

    accel_mode = hwaccel
    if hwaccel == "auto":
        accel_mode = "vaapi" if os.path.exists(vaapi_device) else "none"

    if accel_mode == "vaapi":
        cmd += [
            "-vaapi_device", vaapi_device,
            "-vf", "format=nv12,hwupload",
            "-c:v", "h264_vaapi",
        ]
    else:
        cmd += [
            "-vf", "format=yuv420p",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-tune", "zerolatency",
        ]

    cmd += [
        "-b:v", "2500k", "-maxrate", "2500k", "-bufsize", "5000k",
        "-g", str(max(1, fps*2)), "-bf", "0",
        "-an", "-rtsp_transport", "tcp",
        "-f", "rtsp", out_url
    ]
    print(f"[INFO] ffmpeg 使用 {accel_mode} 编碼 (hwaccel={hwaccel}).")
    if accel_mode == "vaapi" and not os.path.exists(vaapi_device):
        print(f"[WARN] 找不到 VAAPI device：{vaapi_device}，ffmpeg 可能會啟動失敗。")
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)

class GracefulKiller:
    def __init__(self):
        self.stop = False
        signal.signal(signal.SIGINT, self._exit)
        signal.signal(signal.SIGTERM, self._exit)
    def _exit(self, *_):
        self.stop = True

def open_capture(rtsp_url: str, force_tcp: bool) -> cv2.VideoCapture:
    url = rtsp_url
    if force_tcp and "rtsp_transport" not in rtsp_url:
        url += ("&" if "?" in url else "?") + "rtsp_transport=tcp"
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    try: cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception: pass
    return cap

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--in",
        dest="in_url",
        default="rtsp://publisher:secret@go2rtc:8554/cam1_raw",
        help="輸入 RTSP (raw)",
    )
    ap.add_argument(
        "--out",
        dest="out_url",
        default="rtsp://publisher:secret@go2rtc:8554/cam1_overlay",
        help="輸出 RTSP (overlay)",
    )
    ap.add_argument("--w", type=int, default=1280)
    ap.add_argument("--h", type=int, default=720)
    ap.add_argument("--fps", type=int, default=15)
    ap.add_argument("--show", action="store_true")
    ap.add_argument("--reconnect_sec", type=float, default=2.0)
    ap.add_argument("--tcp_pull", action="store_true", help="拉流也強制 TCP")
    ap.add_argument("--max_open_retries", type=int, default=10, help="開 RTSP 連續失敗次數上限")
    default_hwaccel = os.getenv("ACTION_HWACCEL", "auto").lower()
    if default_hwaccel not in {"auto", "vaapi", "none"}:
        default_hwaccel = "auto"
    ap.add_argument(
        "--hwaccel",
        choices=["auto", "vaapi", "none"],
        default=default_hwaccel,
        help="輸出串流編碼方式（auto→偵測 VAAPI 裝置，none→純軟體）。",
    )
    ap.add_argument(
        "--vaapi_device",
        default=os.getenv("VAAPI_DEVICE", "/dev/dri/renderD128"),
        help="VAAPI 裝置路徑（僅在 hwaccel=vaapi 時使用）。",
    )
    args = ap.parse_args()

    W, H, FPS = args.w, args.h, args.fps
    killer = GracefulKiller()

    open_fail_count = 0  # 連續「開 RTSP」失敗計數

    while not killer.stop:
        cap = open_capture(args.in_url, args.tcp_pull)
        if not cap.isOpened():
            open_fail_count += 1
            print(f"[WARN] 開 RTSP 失敗：{args.in_url}，{args.reconnect_sec:.1f}s 後重試... "
                  f"({open_fail_count}/{args.max_open_retries})")
            if open_fail_count >= args.max_open_retries:
                print("[ERROR] 開 RTSP 連續失敗達上限，程式結束。")
                sys.exit(2)
            time.sleep(args.reconnect_sec)
            continue

        # 成功開啟後歸零
        open_fail_count = 0

        ff = build_ffmpeg_proc(args.out_url, W, H, FPS, args.hwaccel, args.vaapi_device)
        if ff.stdin is None:
            print("[ERROR] 無法啟動 ffmpeg，重試中...")
            time.sleep(args.reconnect_sec)
            try: cap.release()
            except: pass
            continue

        last_ok = time.time()
        try:
            while not killer.stop:
                ok, frame = cap.read()
                if not ok or frame is None:
                    if time.time() - last_ok > 2.0:
                        print("[WARN] 取不到幀，重連中...")
                        break
                    time.sleep(0.02)
                    continue
                last_ok = time.time()

                if frame.shape[1] != W or frame.shape[0] != H:
                    frame = cv2.resize(frame, (W, H), interpolation=cv2.INTER_LINEAR)

                frame = draw_overlay(frame)

                try:
                    ff.stdin.write(frame.tobytes())
                except (BrokenPipeError, Exception) as e:
                    print(f"[WARN] ffmpeg 管線中斷：{e}，重連中...")
                    break

                if args.show:
                    cv2.imshow("overlay_preview", frame)
                    if cv2.waitKey(1) & 0xFF == 27:
                        killer.stop = True
                        break
        finally:
            try: cap.release()
            except: pass
            try:
                if ff and ff.stdin: ff.stdin.close()
                if ff: ff.wait(timeout=2)
            except:
                try: ff.kill()
                except: pass
            if args.show:
                try: cv2.destroyAllWindows()
                except: pass

        if not killer.stop:
            time.sleep(args.reconnect_sec)

    print("[INFO] 程式結束")

if __name__ == "__main__":
    main()
