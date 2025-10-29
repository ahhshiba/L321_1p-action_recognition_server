#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import subprocess
import signal
import sys
import time
import cv2
import numpy as np
import threading
from flask import Flask, Response

def draw_overlay(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (int(0.1*w), int(0.1*h)), (int(0.4*w), int(0.4*h)), (0, 255, 0), 2)
    cv2.putText(frame, "Action: carry 0.91", (int(0.1*w), int(0.09*h)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2, cv2.LINE_AA)
    return frame

def build_ffmpeg_proc(out_url: str, w: int, h: int, fps: int) -> subprocess.Popen:
    cmd = [
        "ffmpeg", "-re",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
        "-vaapi_device", "/dev/dri/renderD128",
        "-vf", "format=nv12,hwupload",
        "-c:v", "h264_vaapi",
        "-b:v", "2500k", "-maxrate", "2500k", "-bufsize", "5000k",
        "-g", str(max(1, fps*2)), "-bf", "0",
        "-an", "-rtsp_transport", "tcp",
        "-f", "rtsp", out_url
    ]
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

app = Flask(__name__)
_latest_frame = None
_frame_lock = threading.Lock()

@app.route('/stream.mjpg')
def mjpeg_stream():
    def generator():
        boundary = b'--frame\r\nContent-Type: image/jpeg\r\n\r\n'
        while True:
            with _frame_lock:
                frame = _latest_frame
            if frame is None:
                time.sleep(0.1)
                continue
            yield boundary + frame + b'\r\n'
            # small throttle
            time.sleep(max(0.01, 1.0 / (FPS if 'FPS' in globals() and FPS > 0 else 15)))
    return Response(generator(), mimetype='multipart/x-mixed-replace; boundary=frame')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_url", default="rtsp://127.0.0.1:8556/cam1_raw", help="輸入 RTSP (raw)")
    ap.add_argument("--out", dest="out_url", default="rtsp://127.0.0.1:8556/cam1_overlay", help="輸出 RTSP (overlay)")
    ap.add_argument("--w", type=int, default=1280)
    ap.add_argument("--h", type=int, default=720)
    ap.add_argument("--fps", type=int, default=15)
    ap.add_argument("--show", action="store_true")
    ap.add_argument("--reconnect_sec", type=float, default=2.0)
    ap.add_argument("--tcp_pull", action="store_true", help="拉流也強制 TCP")
    ap.add_argument("--max_open_retries", type=int, default=10, help="開 RTSP 連續失敗次數上限")
    args = ap.parse_args()

    W, H, FPS = args.w, args.h, args.fps
    killer = GracefulKiller()

    open_fail_count = 0  # 連續「開 RTSP」失敗計數

    # 啟動 Flask 在背景 thread（暴露 8000）
    def run_flask():
        app.run(host='0.0.0.0', port=8000, threaded=True)

    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

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

        ff = build_ffmpeg_proc(args.out_url, W, H, FPS)
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

                # 更新全域最新 JPEG，供 /stream.mjpg 使用
                try:
                    ret, jpeg = cv2.imencode('.jpg', frame)
                    if ret:
                        with _frame_lock:
                            _latest_frame = jpeg.tobytes()
                except Exception:
                    pass

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
