import json
import logging
import os
import queue
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import paho.mqtt.client as mqtt
from psycopg_pool import ConnectionPool


@dataclass
class CameraConfig:
    camera_id: str
    stream_id: str
    rtsp_url: str


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def floor_to_segment(ts: datetime, segment_seconds: int) -> datetime:
    epoch = int(ts.timestamp())
    floored = epoch - (epoch % segment_seconds)
    return datetime.fromtimestamp(floored, tz=timezone.utc)


def segment_path(recordings_dir: str, camera_id: str, start_ts: datetime) -> str:
    return os.path.join(
        recordings_dir,
        camera_id,
        start_ts.strftime("%Y-%m"),
        start_ts.strftime("%d"),
        start_ts.strftime("%H-%M-%S.mkv"),
    )


def segment_path_ts(recordings_dir: str, camera_id: str, start_ts: datetime) -> str:
    return os.path.join(
        recordings_dir,
        camera_id,
        start_ts.strftime("%Y-%m"),
        start_ts.strftime("%d"),
        start_ts.strftime("%H-%M-%S.ts"),
    )


def ensure_dirs_for_ts(recordings_dir: str, camera_id: str, ts: datetime) -> None:
    target_dir = os.path.join(recordings_dir, camera_id, ts.strftime("%Y-%m"), ts.strftime("%d"))
    os.makedirs(target_dir, exist_ok=True)


def build_rtsp_url(stream_host: str, stream_port: str, stream_id: str, rtsp_url: Optional[str]) -> str:
    if rtsp_url and rtsp_url.startswith("rtsp://") and "127.0.0.1" not in rtsp_url and "localhost" not in rtsp_url:
        return rtsp_url
    return f"rtsp://{stream_host}:{stream_port}/{stream_id}"


class Recorder(threading.Thread):
    def __init__(self, camera: CameraConfig, recordings_dir: str, segment_seconds: int, stop_event: threading.Event):
        super().__init__(daemon=True)
        self.camera = camera
        self.recordings_dir = recordings_dir
        self.segment_seconds = segment_seconds
        self.stop_event = stop_event
        self._last_logged_path: Optional[str] = None
        self._last_logged_mtime: float = 0.0
        self._processed_segments = set()
        self._ts_state: Dict[str, tuple] = {}
        self._postprocess_faststart = os.getenv("POSTPROCESS_FASTSTART", "1") == "1"
        self._postprocess_stable_seconds = int(os.getenv("POSTPROCESS_STABLE_SECONDS", "2"))
        self._postprocess_remux_mp4 = os.getenv("POSTPROCESS_REMUX_MP4", "1") == "1"

    def _remux_to_mp4(self, mkv_path: str) -> Optional[str]:
        if not self._postprocess_remux_mp4:
            return None
        if os.path.splitext(mkv_path)[1].lower() != ".mkv":
            return None
        mp4_path = f"{os.path.splitext(mkv_path)[0]}.mp4"
        if os.path.exists(mp4_path):
            try:
                if os.path.getsize(mp4_path) > 0:
                    return mp4_path
            except OSError:
                pass
        tmp_path = f"{mp4_path}.tmp"
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-fflags",
            "+genpts+discardcorrupt",
            "-err_detect",
            "ignore_err",
            "-i",
            mkv_path,
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            "-f",
            "mp4",
            tmp_path,
        ]
        result = subprocess.run(cmd)
        if result.returncode != 0:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            logging.warning("MP4 remux failed for %s", mkv_path)
            return None
        os.replace(tmp_path, mp4_path)
        try:
            os.remove(mkv_path)
        except OSError:
            logging.warning("Failed to remove MKV after remux: %s", mkv_path)
        return mp4_path

    def _ensure_dirs_loop(self) -> None:
        while not self.stop_event.is_set():
            now = datetime.now(timezone.utc)
            ensure_dirs_for_ts(self.recordings_dir, self.camera.camera_id, now)
            ensure_dirs_for_ts(self.recordings_dir, self.camera.camera_id, now + timedelta(days=1))
            self.stop_event.wait(60)

    def _postprocess_segment(self, path: str) -> Optional[str]:
        if not self._postprocess_faststart:
            logging.info("Postprocess disabled (POSTPROCESS_FASTSTART=0); keep segment %s", path)
            return None
        ext = os.path.splitext(path)[1].lower()
        if ext not in {".ts", ".mp4", ".mkv"}:
            return None
        if path in self._processed_segments:
            return None
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            return None
        if (time.time() - mtime) < self._postprocess_stable_seconds:
            logging.debug("Postprocess wait stable: %s (age=%.2fs)", path, time.time() - mtime)
            return None

        output_path = path
        if ext == ".ts":
            output_path = f"{os.path.splitext(path)[0]}.mkv"
            logging.info("Postprocess remux %s -> %s", path, output_path)
        tmp_path = f"{output_path}.tmp"
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-fflags",
            "+genpts+discardcorrupt",
            "-err_detect",
            "ignore_err",
            "-i",
            path,
            "-c",
            "copy",
        ]
        if ext == ".mp4":
            cmd += ["-movflags", "+faststart"]
        if ext in {".mkv", ".ts"}:
            cmd += ["-f", "matroska"]
        cmd.append(tmp_path)
        result = subprocess.run(cmd)
        if result.returncode != 0:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            logging.warning("Postprocess failed for %s", path)
            return None
        os.replace(tmp_path, output_path)
        if ext == ".ts":
            try:
                os.remove(path)
            except OSError:
                pass
        self._processed_segments.add(path)
        if len(self._processed_segments) > 500:
            self._processed_segments = set(list(self._processed_segments)[-250:])
        logging.info("Recorded segment %s", output_path)
        mp4_path = self._remux_to_mp4(output_path)
        if mp4_path:
            logging.info("Remuxed segment to %s", mp4_path)
        return output_path

    def _watch_segments(self) -> None:
        while not self.stop_event.is_set():
            now = datetime.now()
            candidate_dirs = [
                os.path.join(self.recordings_dir, self.camera.camera_id, now.strftime("%Y-%m"), now.strftime("%d")),
                os.path.join(
                    self.recordings_dir,
                    self.camera.camera_id,
                    (now - timedelta(days=1)).strftime("%Y-%m"),
                    (now - timedelta(days=1)).strftime("%d"),
                ),
            ]
            ts_candidates = []
            seen_paths = set()
            for directory in candidate_dirs:
                if not os.path.isdir(directory):
                    continue
                try:
                    for name in os.listdir(directory):
                        if not name.endswith(".ts"):
                            continue
                        path = os.path.join(directory, name)
                        seen_paths.add(path)
                        try:
                            mtime = os.path.getmtime(path)
                            size = os.path.getsize(path)
                        except OSError:
                            continue
                        ts_candidates.append((mtime, size, path))
                except OSError:
                    continue
            if ts_candidates:
                for mtime, size, path in sorted(ts_candidates):
                    previous = self._ts_state.get(path)
                    if previous and (size, mtime) == previous:
                        if (time.time() - mtime) >= self._postprocess_stable_seconds:
                            output_path = self._postprocess_segment(path)
                            if output_path and (
                                output_path != self._last_logged_path or mtime > self._last_logged_mtime
                            ):
                                self._last_logged_path = output_path
                                self._last_logged_mtime = mtime
                            self._ts_state.pop(path, None)
                        continue
                    self._ts_state[path] = (size, mtime)
            if self._ts_state:
                for path in list(self._ts_state.keys()):
                    if path not in seen_paths:
                        self._ts_state.pop(path, None)
            time.sleep(1)

    def run(self) -> None:
        dir_thread = threading.Thread(target=self._ensure_dirs_loop, daemon=True)
        dir_thread.start()
        watch_thread = threading.Thread(target=self._watch_segments, daemon=True)
        watch_thread.start()

        output_pattern = os.path.join(
            self.recordings_dir,
            self.camera.camera_id,
            "%Y-%m",
            "%d",
            "%H-%M-%S.ts",
        )

        while not self.stop_event.is_set():
            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "warning",
                "-rtsp_transport",
                "tcp",
                "-i",
                self.camera.rtsp_url,
                "-an",
                "-c",
                "copy",
                "-f",
                "segment",
                "-segment_time",
                str(self.segment_seconds),
                "-segment_atclocktime",
                "1",
                "-reset_timestamps",
                "1",
                "-segment_format",
                "mpegts",
                "-strftime",
                "1",
                output_pattern,
            ]
            logging.info("Recording %s -> %s", self.camera.camera_id, output_pattern)
            process = subprocess.Popen(cmd)
            while process.poll() is None and not self.stop_event.is_set():
                time.sleep(1)
            if self.stop_event.is_set():
                process.terminate()
                break
            logging.warning("Recorder for %s exited; restarting in 3s", self.camera.camera_id)
            time.sleep(3)


class BufferRecorder(threading.Thread):
    def __init__(
        self,
        camera: CameraConfig,
        buffer_dir: str,
        segment_seconds: int,
        retention_seconds: int,
        reencode: bool,
        gop: int,
        stop_event: threading.Event,
    ):
        super().__init__(daemon=True)
        self.camera = camera
        self.buffer_dir = buffer_dir
        self.segment_seconds = segment_seconds
        self.retention_seconds = retention_seconds
        self.reencode = reencode
        self.gop = gop
        self.stop_event = stop_event

    def _cleanup_loop(self) -> None:
        while not self.stop_event.is_set():
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.retention_seconds)
            base_dir = os.path.join(self.buffer_dir, self.camera.camera_id)
            if os.path.isdir(base_dir):
                for root, _, files in os.walk(base_dir):
                    for name in files:
                        if not name.endswith(".ts"):
                            continue
                        path = os.path.join(root, name)
                        try:
                            mtime = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)
                        except OSError:
                            continue
                        if mtime < cutoff:
                            try:
                                os.remove(path)
                            except OSError:
                                pass
            self.stop_event.wait(5)

    def run(self) -> None:
        cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        cleanup_thread.start()

        output_pattern = os.path.join(
            self.buffer_dir,
            self.camera.camera_id,
            "%Y-%m",
            "%d",
            "%H-%M-%S.ts",
        )

        while not self.stop_event.is_set():
            ensure_dirs_for_ts(self.buffer_dir, self.camera.camera_id, datetime.now(timezone.utc))
            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "warning",
                "-rtsp_transport",
                "tcp",
                "-i",
                self.camera.rtsp_url,
                "-an",
            ]
            if self.reencode:
                cmd += [
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-tune",
                    "zerolatency",
                    "-g",
                    str(self.gop),
                    "-keyint_min",
                    str(self.gop),
                    "-sc_threshold",
                    "0",
                    "-pix_fmt",
                    "yuv420p",
                ]
            else:
                cmd += ["-c", "copy"]
            cmd += [
                "-f",
                "segment",
                "-segment_time",
                str(self.segment_seconds),
                "-segment_atclocktime",
                "1",
                "-reset_timestamps",
                "1",
                "-segment_format",
                "mpegts",
                "-strftime",
                "1",
                output_pattern,
            ]
            logging.info("Buffer recording %s -> %s", self.camera.camera_id, output_pattern)
            process = subprocess.Popen(cmd)
            while process.poll() is None and not self.stop_event.is_set():
                time.sleep(1)
            if self.stop_event.is_set():
                process.terminate()
                break
            logging.warning("Buffer recorder for %s exited; restarting in 3s", self.camera.camera_id)
            time.sleep(3)


class EventClipper(threading.Thread):
    def __init__(
        self,
        recordings_dir: str,
        events_dir: str,
        segment_seconds: int,
        pre_seconds: int,
        post_seconds: int,
        buffer_dir: str,
        buffer_segment_seconds: int,
        buffer_enabled: bool,
        buffer_reencode: bool,
        buffer_gop: int,
        db_pool: Optional[ConnectionPool],
        stop_event: threading.Event,
    ):
        super().__init__(daemon=True)
        self.recordings_dir = recordings_dir
        self.events_dir = events_dir
        self.segment_seconds = segment_seconds
        self.pre_seconds = pre_seconds
        self.post_seconds = post_seconds
        self.buffer_dir = buffer_dir
        self.buffer_segment_seconds = buffer_segment_seconds
        self.buffer_enabled = buffer_enabled
        self.buffer_reencode = buffer_reencode
        self.buffer_gop = buffer_gop
        self.db_pool = db_pool
        self.stop_event = stop_event
        self.queue: "queue.Queue[dict]" = queue.Queue()
        self.segment_ready_grace = int(os.getenv("SEGMENT_READY_GRACE", "2"))
        self.segment_max_wait = int(os.getenv("SEGMENT_MAX_WAIT", "15"))
        self.buffer_ready_grace = int(os.getenv("EVENT_BUFFER_READY_GRACE", "2"))
        self.cameras: Dict[str, CameraConfig] = {}

    def set_cameras(self, cameras: Dict[str, CameraConfig]) -> None:
        self.cameras = cameras

    def enqueue(self, event_payload: dict) -> None:
        self.queue.put(event_payload)

    def run(self) -> None:
        os.makedirs(self.events_dir, exist_ok=True)
        while not self.stop_event.is_set():
            try:
                payload = self.queue.get(timeout=1)
            except queue.Empty:
                continue
            try:
                self._handle_event(payload)
            except Exception as exc:
                logging.exception("Failed to handle event clip: %s", exc)
            finally:
                self.queue.task_done()

    def _handle_event(self, payload: dict) -> None:
        if self.buffer_enabled:
            handled = self._handle_event_buffer(payload)
            if handled:
                return
        self._handle_event_segment(payload)

    def _handle_event_segment(self, payload: dict) -> None:
        event_id = payload.get("id")
        camera_id = payload.get("camera_id") or payload.get("cameraId")
        ts_value = payload.get("ts") or payload.get("timestamp")
        if not (event_id and camera_id and ts_value):
            logging.warning("Skipping event payload with missing fields: %s", payload)
            return

        event_time = parse_timestamp(ts_value)
        clip_start = event_time - timedelta(seconds=self.pre_seconds)
        clip_end = event_time + timedelta(seconds=self.post_seconds)
        logging.info(
            "Event received id=%s camera=%s ts=%s clip=[%s..%s] recordings_dir=%s",
            event_id,
            camera_id,
            event_time.isoformat(),
            clip_start.isoformat(),
            clip_end.isoformat(),
            self.recordings_dir,
        )

        segment_start = floor_to_segment(clip_start, self.segment_seconds)
        segment_end = floor_to_segment(clip_end, self.segment_seconds)

        segment_times = []
        current = segment_start
        while current <= segment_end:
            segment_times.append(current)
            current += timedelta(seconds=self.segment_seconds)
        logging.info(
            "Event %s needs %d segment(s) from %s to %s (segment_seconds=%d)",
            event_id,
            len(segment_times),
            segment_start.isoformat(),
            segment_end.isoformat(),
            self.segment_seconds,
        )

        wait_deadline = time.time() + self.segment_max_wait
        segment_files = []
        segment_file_times = []
        last_missing = []
        while time.time() <= wait_deadline and not self.stop_event.is_set():
            segment_files = []
            segment_file_times = []
            now = datetime.now(timezone.utc)
            missing = False
            last_missing = []
            for ts in segment_times:
                segment_end_ts = ts + timedelta(seconds=self.segment_seconds)
                ready_ts = segment_end_ts
                if segment_end_ts > clip_end:
                    ready_ts = clip_end
                if now < (ready_ts + timedelta(seconds=self.segment_ready_grace)):
                    missing = True
                    last_missing.append(
                        f"not_ready ts={ts.isoformat()} ready_after={ (ready_ts + timedelta(seconds=self.segment_ready_grace)).isoformat() }"
                    )
                    continue
                path_ts = segment_path_ts(self.recordings_dir, camera_id, ts)
                path_mkv = segment_path(self.recordings_dir, camera_id, ts)
                path_mp4 = os.path.splitext(path_mkv)[0] + ".mp4"
                path = None
                if os.path.exists(path_ts):
                    path = path_ts
                elif os.path.exists(path_mp4):
                    path = path_mp4
                elif os.path.exists(path_mkv):
                    path = path_mkv
                else:
                    missing = True
                    last_missing.append(
                        f"missing_file ts={ts.isoformat()} ts_path={path_ts} mp4_path={path_mp4} mkv_path={path_mkv}"
                    )
                    continue
                if os.path.getsize(path) == 0:
                    missing = True
                    last_missing.append(f"empty_file ts={ts.isoformat()} path={path}")
                    continue
                segment_files.append(path)
                segment_file_times.append(ts)
            if not missing and segment_files:
                break
            time.sleep(1)

        if not segment_files:
            logging.warning(
                "No segment files found for event %s (camera=%s ts=%s clip=[%s..%s]) missing=%s",
                event_id,
                camera_id,
                event_time.isoformat(),
                clip_start.isoformat(),
                clip_end.isoformat(),
                "; ".join(last_missing) if last_missing else "unknown",
            )
            return

        concat_list_path = f"/tmp/concat_{event_id}.txt"
        with open(concat_list_path, "w", encoding="utf-8") as fp:
            for path in segment_files:
                fp.write(f"file '{path}'\n")

        first_segment_start = segment_file_times[0]
        offset = max(0.0, (clip_start - first_segment_start).total_seconds())
        duration = (clip_end - clip_start).total_seconds()
        if duration <= 0:
            logging.warning("Event clip duration is non-positive for %s", event_id)
            return

        output_name = f"{event_id}.mp4"
        output_path = os.path.join(self.events_dir, output_name)
        min_event_bytes = int(os.getenv("EVENT_MIN_BYTES", "4096"))
        if os.path.exists(output_path):
            try:
                if os.path.getsize(output_path) >= min_event_bytes:
                    logging.info("Event clip already exists for %s", event_id)
                    self._update_thumbnail(event_id, output_name)
                    return
                logging.warning("Event clip too small for %s; regenerating", event_id)
                os.remove(output_path)
            except OSError:
                logging.warning("Failed to stat existing event clip for %s", event_id)
                return

        output_tmp_path = f"{output_path}.tmp"
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-fflags",
            "+genpts+discardcorrupt",
            "-err_detect",
            "ignore_err",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_list_path,
            "-ss",
            f"{offset}",
            "-t",
            f"{duration}",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-an",
            "-movflags",
            "+faststart",
            "-f",
            "mp4",
            output_tmp_path,
        ]

        try:
            result = subprocess.run(cmd)
        finally:
            try:
                os.remove(concat_list_path)
            except OSError:
                pass
        if result.returncode != 0:
            try:
                os.remove(output_tmp_path)
            except OSError:
                pass
            logging.warning("ffmpeg failed for event %s", event_id)
            return
        try:
            if os.path.getsize(output_tmp_path) < min_event_bytes:
                logging.warning("Event clip too small after encode for %s", event_id)
                os.remove(output_tmp_path)
                return
            os.replace(output_tmp_path, output_path)
        except OSError:
            logging.warning("Failed to finalize event clip for %s", event_id)
            return

        logging.info("Wrote event clip %s", output_path)
        self._update_thumbnail(event_id, output_name)

    def _handle_event_buffer(self, payload: dict) -> bool:
        event_id = payload.get("id")
        camera_id = payload.get("camera_id") or payload.get("cameraId")
        ts_value = payload.get("ts") or payload.get("timestamp")
        if not (event_id and camera_id and ts_value):
            logging.warning("Skipping event payload with missing fields: %s", payload)
            return True
        camera = self.cameras.get(camera_id)
        if not camera:
            logging.warning("No camera config found for event %s camera=%s", event_id, camera_id)
            return False

        event_time = parse_timestamp(ts_value)
        clip_start = event_time - timedelta(seconds=self.pre_seconds)
        clip_end = event_time + timedelta(seconds=self.post_seconds)
        logging.info(
            "Event received (buffer) id=%s camera=%s ts=%s clip=[%s..%s] buffer_dir=%s",
            event_id,
            camera_id,
            event_time.isoformat(),
            clip_start.isoformat(),
            clip_end.isoformat(),
            self.buffer_dir,
        )

        expected_pre_times = []
        current = floor_to_segment(clip_start, self.buffer_segment_seconds)
        while current < event_time:
            expected_pre_times.append(current)
            current += timedelta(seconds=self.buffer_segment_seconds)

        def _scan_pre_segments():
            pairs = []
            missing = []
            for ts in expected_pre_times:
                path = segment_path_ts(self.buffer_dir, camera_id, ts)
                if os.path.exists(path) and os.path.getsize(path) > 0:
                    pairs.append((ts, path))
                else:
                    missing.append(f"{ts.isoformat()}:{path}")
            return pairs, missing

        pre_segment_pairs, missing_pre = _scan_pre_segments()
        if missing_pre:
            logging.warning(
                "Missing pre-buffer segments for %s (camera=%s) missing=%s",
                event_id,
                camera_id,
                "; ".join(missing_pre),
            )

        post_tmp_path = f"/tmp/post_{event_id}.ts"
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-rtsp_transport",
            "tcp",
            "-i",
            camera.rtsp_url,
            "-an",
        ]
        if self.buffer_reencode:
            cmd += [
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-tune",
                "zerolatency",
                "-g",
                str(self.buffer_gop),
                "-keyint_min",
                str(self.buffer_gop),
                "-sc_threshold",
                "0",
                "-pix_fmt",
                "yuv420p",
            ]
        else:
            cmd += ["-c", "copy"]
        cmd += [
            "-t",
            str(self.post_seconds),
            "-f",
            "mpegts",
            post_tmp_path,
        ]
        logging.info("Recording post buffer for %s camera=%s seconds=%d", event_id, camera_id, self.post_seconds)
        result = subprocess.run(cmd)
        if result.returncode != 0 or not os.path.exists(post_tmp_path):
            try:
                os.remove(post_tmp_path)
            except OSError:
                pass
            logging.warning("Failed to record post buffer for %s", event_id)
            return True

        if missing_pre and self.buffer_ready_grace > 0:
            time.sleep(self.buffer_ready_grace)
        refreshed_pairs, refreshed_missing = _scan_pre_segments()
        if refreshed_missing:
            logging.warning(
                "Pre-buffer segments vanished for %s (camera=%s) missing=%s",
                event_id,
                camera_id,
                "; ".join(refreshed_missing),
            )

        concat_list_path = f"/tmp/concat_{event_id}.txt"
        with open(concat_list_path, "w", encoding="utf-8") as fp:
            for _, path in refreshed_pairs:
                fp.write(f"file '{path}'\n")
            fp.write(f"file '{post_tmp_path}'\n")

        output_name = f"{event_id}.mp4"
        output_path = os.path.join(self.events_dir, output_name)
        min_event_bytes = int(os.getenv("EVENT_MIN_BYTES", "4096"))
        if os.path.exists(output_path):
            try:
                if os.path.getsize(output_path) >= min_event_bytes:
                    logging.info("Event clip already exists for %s", event_id)
                    self._update_thumbnail(event_id, output_name)
                    os.remove(post_tmp_path)
                    os.remove(concat_list_path)
                    return True
                os.remove(output_path)
            except OSError:
                logging.warning("Failed to stat existing event clip for %s", event_id)
                os.remove(post_tmp_path)
                os.remove(concat_list_path)
                return True

        output_tmp_path = f"{output_path}.tmp"
        if refreshed_pairs:
            first_segment_start = refreshed_pairs[0][0]
            offset = max(0.0, (clip_start - first_segment_start).total_seconds())
            duration = self.pre_seconds + self.post_seconds
        else:
            offset = 0.0
            duration = self.post_seconds

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-fflags",
            "+genpts+discardcorrupt",
            "-err_detect",
            "ignore_err",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_list_path,
            "-ss",
            f"{offset}",
            "-t",
            f"{duration}",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-an",
            "-movflags",
            "+faststart",
            "-f",
            "mp4",
            output_tmp_path,
        ]

        try:
            result = subprocess.run(cmd)
        finally:
            try:
                os.remove(post_tmp_path)
            except OSError:
                pass
            try:
                os.remove(concat_list_path)
            except OSError:
                pass
        if result.returncode != 0:
            try:
                os.remove(output_tmp_path)
            except OSError:
                pass
            logging.warning("ffmpeg failed for buffered event %s", event_id)
            return True
        try:
            if os.path.getsize(output_tmp_path) < min_event_bytes:
                logging.warning("Event clip too small after encode for %s", event_id)
                os.remove(output_tmp_path)
                return True
            os.replace(output_tmp_path, output_path)
        except OSError:
            logging.warning("Failed to finalize event clip for %s", event_id)
            return True

        logging.info("Wrote buffered event clip %s", output_path)
        self._update_thumbnail(event_id, output_name)
        return True

    def _update_thumbnail(self, event_id: str, output_name: str) -> None:
        if not self.db_pool:
            return
        try:
            with self.db_pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE events SET thumbnail = %s WHERE id = %s",
                        (output_name, event_id),
                    )
        except Exception as exc:
            logging.error("Failed to update thumbnail for %s: %s", event_id, exc)


class RecorderApp:
    def __init__(self) -> None:
        self.cameras_json = os.getenv("CAMERAS_JSON", "/app/share/cameras.json")
        self.recordings_dir = os.getenv("RECORDINGS_DIR", "/app/share/recordings")
        self.events_dir = os.getenv("EVENTS_DIR", "/app/share/events")
        self.segment_seconds = int(os.getenv("SEGMENT_SECONDS", "300"))
        self.pre_seconds = int(os.getenv("EVENT_PRE_SECONDS", "10"))
        self.post_seconds = int(os.getenv("EVENT_POST_SECONDS", "10"))
        self.buffer_dir = os.getenv("EVENT_BUFFER_DIR", "/app/share/recordings_buffer")
        self.buffer_segment_seconds = int(os.getenv("EVENT_BUFFER_SEGMENT_SECONDS", "1"))
        self.buffer_enabled = os.getenv("EVENT_BUFFER_ENABLED", "1") == "1"
        self.buffer_seconds = int(os.getenv("EVENT_BUFFER_SECONDS", str(self.pre_seconds)))
        self.buffer_reencode = os.getenv("EVENT_BUFFER_REENCODE", "1") == "1"
        self.buffer_gop = int(os.getenv("EVENT_BUFFER_GOP", "10"))

        self.stream_host = os.getenv("STREAM_HOST_INTERNAL", "go2rtc")
        self.stream_port = os.getenv("STREAM_PORT_INTERNAL", "8554")

        self.mqtt_host = os.getenv("MQTT_HOST", "mqtt")
        self.mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
        self.mqtt_topic = os.getenv("MQTT_TOPIC", "vision/+/events")

        self.db_pool = self._init_db()
        self.stop_event = threading.Event()

        self.mqtt_client: Optional[mqtt.Client] = None
        self.clip_worker = EventClipper(
            self.recordings_dir,
            self.events_dir,
            self.segment_seconds,
            self.pre_seconds,
            self.post_seconds,
            self.buffer_dir,
            self.buffer_segment_seconds,
            self.buffer_enabled,
            self.buffer_reencode,
            self.buffer_gop,
            self.db_pool,
            self.stop_event,
        )

    def _init_db(self) -> Optional[ConnectionPool]:
        db_host = os.getenv("DATABASE_HOST")
        db_name = os.getenv("DATABASE_NAME")
        db_user = os.getenv("DATABASE_USER")
        db_pass = os.getenv("DATABASE_PASSWORD")
        db_port = os.getenv("DATABASE_PORT", "5432")
        if not all([db_host, db_name, db_user, db_pass]):
            logging.warning("Database env vars not fully set; thumbnail updates disabled")
            return None
        conninfo = (
            f"host={db_host} port={db_port} dbname={db_name} user={db_user} password={db_pass}"
        )
        return ConnectionPool(conninfo=conninfo, min_size=1, max_size=3, open=True)

    def load_cameras(self) -> Dict[str, CameraConfig]:
        try:
            with open(self.cameras_json, "r", encoding="utf-8") as fp:
                data = json.load(fp)
        except FileNotFoundError:
            logging.error("cameras.json not found at %s", self.cameras_json)
            return {}
        except json.JSONDecodeError as exc:
            logging.error("Failed to parse cameras.json: %s", exc)
            return {}

        cameras = {}
        for camera in data.get("cameras", []):
            if not camera.get("enabled", True):
                continue
            camera_id = camera.get("id")
            stream_id = camera.get("streamUrl") or camera_id
            if not camera_id or not stream_id:
                continue
            if camera_id.endswith("overlay") or stream_id.endswith("overlay"):
                continue
            rtsp_url = build_rtsp_url(
                self.stream_host,
                self.stream_port,
                stream_id,
                camera.get("rtspUrl"),
            )
            cameras[camera_id] = CameraConfig(camera_id=camera_id, stream_id=stream_id, rtsp_url=rtsp_url)
        return cameras

    def start_recorders(self) -> None:
        cameras = self.load_cameras()
        if not cameras:
            logging.warning("No cameras enabled for recording")
        self.clip_worker.set_cameras(cameras)
        for camera in cameras.values():
            os.makedirs(os.path.join(self.recordings_dir, camera.camera_id), exist_ok=True)
            recorder = Recorder(camera, self.recordings_dir, self.segment_seconds, self.stop_event)
            recorder.start()
            if self.buffer_enabled:
                os.makedirs(os.path.join(self.buffer_dir, camera.camera_id), exist_ok=True)
                retention = max(self.buffer_seconds + self.post_seconds + 5, self.buffer_segment_seconds * 3)
                buffer_recorder = BufferRecorder(
                    camera,
                    self.buffer_dir,
                    self.buffer_segment_seconds,
                    retention,
                    self.buffer_reencode,
                    self.buffer_gop,
                    self.stop_event,
                )
                buffer_recorder.start()

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logging.info("Connected to MQTT, subscribing to %s", self.mqtt_topic)
            client.subscribe(self.mqtt_topic)
        else:
            logging.error("MQTT connection failed: %s", rc)

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except json.JSONDecodeError:
            logging.warning("Invalid JSON payload on %s", msg.topic)
            return
        self.clip_worker.enqueue(payload)

    def start_mqtt(self) -> None:
        client = mqtt.Client()
        client.on_connect = self.on_connect
        client.on_message = self.on_message
        client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
        client.loop_start()
        self.mqtt_client = client

    def run(self) -> None:
        self.clip_worker.start()
        self.start_recorders()
        self.start_mqtt()

        def handle_signal(signum, frame):
            logging.info("Shutting down")
            self.stop_event.set()
            if self.mqtt_client:
                self.mqtt_client.loop_stop()
            if self.db_pool:
                self.db_pool.close()

        signal.signal(signal.SIGTERM, handle_signal)
        signal.signal(signal.SIGINT, handle_signal)

        while not self.stop_event.is_set():
            time.sleep(1)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    app = RecorderApp()
    app.run()
