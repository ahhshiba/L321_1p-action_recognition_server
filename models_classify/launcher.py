#!/usr/bin/env python3

import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from typing import Dict, List, Tuple


def log(msg: str) -> None:
    print(f"[launcher] {msg}", flush=True)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def load_json(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class RunnerLauncher:
    def __init__(self, cameras_path: str, models_path: str):
        self.cameras_path = cameras_path
        self.models_path = models_path
        self.processes: List[Tuple[str, subprocess.Popen, List[str]]] = []
        self.stop_requested = False
        signal.signal(signal.SIGTERM, self._handle_stop)
        signal.signal(signal.SIGINT, self._handle_stop)

    def _handle_stop(self, *_):
        self.stop_requested = True
        self._shutdown()

    def _index_models(self, models: List[Dict]) -> List[Tuple[Dict, List[str]]]:
        indexed = []
        for model in models:
            candidates = set()
            name = model.get("name")
            if name:
                candidates.add(name.lower())
                candidates.add(slugify(name))
            weights = model.get("weights")
            if weights:
                weight_stem = Path(weights).stem
                candidates.add(weight_stem.lower())
                candidates.add(slugify(weight_stem))
            model_type = model.get("type")
            if model_type:
                candidates.add(str(model_type).lower())
            indexed.append((model, list(candidates)))
        return indexed

    def _match_model(self, model_id: str, indexed_models: List[Tuple[Dict, List[str]]]) -> Dict:
        target_slug = slugify(model_id)
        target_lower = model_id.lower()
        for model, candidates in indexed_models:
            for candidate in candidates:
                if target_lower == candidate or target_slug == candidate:
                    return model
                if candidate.startswith(target_slug) or target_slug.startswith(candidate):
                    return model
        return {}

    def _rewrite_host_for_container(self, url: str) -> str:
        """
        若 cameras.json 使用 127.0.0.1/localhost（供宿主機上播放），這裡會換成容器內可達的 host。
        透過環境變數 STREAM_HOST_INTERNAL 與 STREAM_PORT_INTERNAL 調整，預設 port=8554。
        """
        internal_host = os.getenv("STREAM_HOST_INTERNAL", "go2rtc")
        internal_port = os.getenv("STREAM_PORT_INTERNAL", "8554")

        try:
            parsed = urlparse(url)
            if parsed.hostname not in {"127.0.0.1", "localhost"}:
                return url  # 已是可連的 host

            port = internal_port if internal_port else (parsed.port or "")
            netloc = internal_host if not port else f"{internal_host}:{port}"
            return urlunparse(parsed._replace(netloc=netloc))
        except Exception:
            return url

    def _build_overlay_url(self, rtsp_url: str) -> str:
        try:
            parsed = urlparse(rtsp_url)
            path_parts = parsed.path.rsplit("/", 1)
            if len(path_parts) == 2:
                prefix, tail = path_parts
                if tail.endswith("_raw"):
                    tail = tail[:-4] + "overlay"
                else:
                    tail = tail + "_overlay"
                new_path = "/".join([prefix, tail])
                return urlunparse(parsed._replace(path=new_path))
        except Exception:
            pass
        return rtsp_url + "_overlay"

    def _collect_camera_models(self) -> Dict[str, List[Dict[str, str]]]:
        data = load_json(self.cameras_path)
        camera_models: Dict[str, List[Dict[str, str]]] = {}
        for cam in data.get("cameras", []):
            if cam.get("enabled", True) is False:
                continue
            model_id = cam.get("modelID")
            if not model_id:
                continue
            cam_id = cam.get("id") or cam.get("name") or "unknown"
            rtsp_in = cam.get("rtspUrl") or ""
            if not rtsp_in:
                continue
            rtsp_in_internal = self._rewrite_host_for_container(rtsp_in)
            rtsp_out = self._build_overlay_url(rtsp_in_internal)
            camera_models.setdefault(model_id, []).append(
                {"id": str(cam_id), "in": rtsp_in_internal, "out": rtsp_out}
            )
        return camera_models

    def _build_launch_plan(self) -> List[Tuple[str, Dict, List[str]]]:
        camera_models = self._collect_camera_models()
        if not camera_models:
            log("No cameras require a model. Nothing to launch.")
            return []

        models_data = load_json(self.models_path).get("models", [])
        indexed_models = self._index_models(models_data)

        plan: List[Tuple[str, Dict, List[str]]] = []
        for model_id, camera_entries in camera_models.items():
            model_cfg = self._match_model(model_id, indexed_models)
            if not model_cfg:
                log(f"WARNING: modelId '{model_id}' referenced by cameras {[c['id'] for c in camera_entries]} not found in models.json")
                continue
            plan.append((model_id, model_cfg, camera_entries))
        return plan

    def _start_runner(self, model_id: str, model_cfg: Dict, camera_entries: List[Dict[str, str]]) -> None:
        runner_path = model_cfg.get("runner")
        weights_path = model_cfg.get("weights")
        input_size = model_cfg.get("inputSize") or []
        class_file = model_cfg.get("class_file")

        if not runner_path:
            log(f"WARNING: model '{model_id}' missing runner path, skipping.")
            return
        if not os.path.isfile(runner_path):
            log(f"WARNING: runner path '{runner_path}' does not exist inside container, skipping '{model_id}'.")
            return
        if not weights_path:
            log(f"WARNING: model '{model_id}' missing weights path, skipping.")
            return

        width, height = 640, 640
        if isinstance(input_size, list) and len(input_size) >= 2:
            try:
                width, height = int(input_size[0]), int(input_size[1])
            except (TypeError, ValueError):
                log(f"WARNING: invalid inputSize for model '{model_id}', using default 640x640.")

        # 為每個攝影機啟動獨立的 runner 進程
        for cam_entry in camera_entries:
            cam_id = cam_entry["id"]
            input_url = cam_entry["in"]
            output_url = cam_entry["out"]

            cmd = [
                sys.executable,
                runner_path,
                "--weights",
                str(weights_path),
                "--input-width",
                str(width),
                "--input-height",
                str(height),
                "--model-name",
                str(model_cfg.get("name", model_id)),
                "--model-id",
                model_id,
                "--cameras", cam_id,
                "--input-url", input_url,
                "--output-url", output_url,
            ]

            device = model_cfg.get("device")
            if device:
                cmd += ["--device", str(device)]

            if class_file:
                cmd += ["--class-file", str(class_file)]

            # 🔽🔽🔽 新增：從環境變數帶 MQTT 參數給 runner 🔽🔽🔽
            mqtt_host = os.getenv("MQTT_HOST")
            if mqtt_host:
                cmd += ["--mqtt-host", mqtt_host]

                mqtt_port = os.getenv("MQTT_PORT")
                if mqtt_port:
                    cmd += ["--mqtt-port", str(mqtt_port)]

                mqtt_topic = os.getenv("MQTT_TOPIC")
                if mqtt_topic:
                    cmd += ["--mqtt-topic", mqtt_topic]

                mqtt_username = os.getenv("MQTT_USERNAME")
                if mqtt_username:
                    cmd += ["--mqtt-username", mqtt_username]
                    mqtt_password = os.getenv("MQTT_PASSWORD")
                    if mqtt_password:
                        cmd += ["--mqtt-password", mqtt_password]

                mqtt_qos = os.getenv("MQTT_QOS")
                if mqtt_qos:
                    cmd += ["--mqtt-qos", str(mqtt_qos)]

            log(f"Starting model '{model_id}' for camera '{cam_id}' with runner {runner_path}")
            try:
                proc = subprocess.Popen(cmd)
            except FileNotFoundError:
                log(f"ERROR: unable to start runner for '{model_id}' camera '{cam_id}', python executable not found.")
                continue
            except Exception as exc:  # pragma: no cover - best effort logging
                log(f"ERROR: failed to start runner for '{model_id}' camera '{cam_id}': {exc}")
                continue

            self.processes.append((f"{model_id}_{cam_id}", proc, cmd))


    def launch(self) -> bool:
        plan = self._build_launch_plan()
        if not plan:
            return False

        for model_id, model_cfg, camera_ids in plan:
            self._start_runner(model_id, model_cfg, camera_ids)

        if not self.processes:
            log("No runner processes were launched.")
            return False

        return True

    def _shutdown(self) -> None:
        for model_id, proc, _ in list(self.processes):
            if proc.poll() is not None:
                continue
            log(f"Stopping runner for '{model_id}'...")
            try:
                proc.terminate()
            except Exception:
                continue

        for _, proc, _ in list(self.processes):
            try:
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    def wait(self) -> None:
        while not self.stop_requested:
            alive = []
            for model_id, proc, cmd in self.processes:
                rc = proc.poll()
                if rc is None:
                    alive.append((model_id, proc, cmd))
                    continue
                log(f"Runner for '{model_id}' exited with code {rc}. Command: {cmd}")
            self.processes = alive
            if not self.processes:
                log("All runner processes exited.")
                break
            time.sleep(1)


def main() -> None:
    cameras_path = os.getenv("CAMERAS_JSON", "/app/share/cameras.json")
    models_path = os.getenv("MODELS_JSON", "/app/share/models.json")

    if not os.path.isfile(cameras_path):
        log(f"ERROR: cameras.json not found at {cameras_path}")
        sys.exit(1)
    if not os.path.isfile(models_path):
        log(f"ERROR: models.json not found at {models_path}")
        sys.exit(1)

    launcher = RunnerLauncher(cameras_path, models_path)
    if not launcher.launch():
        sys.exit(1)
    launcher.wait()


if __name__ == "__main__":
    main()
