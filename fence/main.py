#!/usr/bin/env python3

import json
import logging
import os
import signal
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Event
from typing import Dict, List, Optional, Sequence, Tuple

import paho.mqtt.client as mqtt
from psycopg_pool import ConnectionPool


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)


@dataclass
class VirtualFence:
    name: str
    points: List[Tuple[float, float]]  # normalized coordinates
    detect_objects: List[str]
    enabled: bool = True


@dataclass
class CameraFenceConfig:
    camera_id: str
    width: int
    height: int
    fences: List[VirtualFence]


def parse_resolution(resolution: str) -> Optional[Tuple[int, int]]:
    if not resolution:
        return None
    try:
        width_str, height_str = resolution.lower().split("x")
        width = int(width_str.strip())
        height = int(height_str.strip())
        if width > 0 and height > 0:
            return width, height
    except Exception:
        pass
    return None


def normalize_points(
    points: Sequence[Dict[str, float]],
    width: int,
    height: int,
) -> List[Tuple[float, float]]:
    """
    Normalize polygon points to 0-1 range. Accepts either normalized or pixel coordinates.
    """
    if not points:
        return []

    looks_normalized = all(
        0.0 <= float(pt.get("x", -1.0)) <= 1.0 and 0.0 <= float(pt.get("y", -1.0)) <= 1.0 for pt in points
    )
    normalized: List[Tuple[float, float]] = []
    for pt in points:
        x = float(pt.get("x", 0.0))
        y = float(pt.get("y", 0.0))
        if not looks_normalized:
            x = x / width if width else 0.0
            y = y / height if height else 0.0
        normalized.append((max(0.0, min(1.0, x)), max(0.0, min(1.0, y))))
    return normalized


def point_in_polygon(x: float, y: float, polygon: Sequence[Tuple[float, float]]) -> bool:
    """
    Ray casting algorithm to check whether a normalized point falls inside the polygon.
    """
    if len(polygon) < 3:
        return False
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersects = (yi > y) != (yj > y) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


def parse_timestamp(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    ts_str = value.strip()
    if ts_str.endswith("Z"):
        ts_str = ts_str[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(ts_str)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


class FenceService:
    def __init__(self):
        self.cameras_json = os.environ.get("CAMERAS_JSON", "/app/share/cameras.json")
        self.mqtt_host = os.environ.get("MQTT_HOST", "mqtt")
        self.mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))
        self.mqtt_topic = os.environ.get("MQTT_TOPIC", "vision/+/detections")
        self.mqtt_username = os.environ.get("MQTT_USERNAME")
        self.mqtt_password = os.environ.get("MQTT_PASSWORD")
        self.mqtt_qos = int(os.environ.get("MQTT_QOS", "0"))

        self.db_url = os.environ.get("DATABASE_URL")
        self.db_host = os.environ.get("DATABASE_HOST", "postgres")
        self.db_port = int(os.environ.get("DATABASE_PORT", "5432"))
        self.db_name = os.environ.get("DATABASE_NAME", "vision")
        self.db_user = os.environ.get("DATABASE_USER", "vision_user")
        self.db_password = os.environ.get("DATABASE_PASSWORD", "vision_pass")

        self.cooldown_seconds = float(os.environ.get("FENCE_COOLDOWN_SEC", "30"))
        self.position_digits = max(0, int(os.environ.get("FENCE_POSITION_DIGITS", "2")))
        self.stop_event = Event()
        self.camera_map: Dict[str, CameraFenceConfig] = {}
        self.mqtt_client: Optional[mqtt.Client] = None
        self.db_pool: Optional[ConnectionPool] = None
        self.last_trigger: Dict[Tuple[str, str, str, float, float], float] = {}

    def start(self):
        self.camera_map = self.load_camera_config()
        if not self.camera_map:
            logging.warning("No cameras with virtual fences were found in %s", self.cameras_json)

        self.db_pool = self._create_db_pool()
        self._setup_mqtt()

        logging.info(
            "Fence service started. Monitoring %d cameras, topic=%s",
            len(self.camera_map),
            self.mqtt_topic,
        )
        while not self.stop_event.is_set():
            time.sleep(0.5)

    def stop(self):
        self.stop_event.set()
        if self.mqtt_client:
            try:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
            except Exception:
                pass
        if self.db_pool:
            self.db_pool.close()

    def _create_db_pool(self) -> ConnectionPool:
        if self.db_url:
            conninfo = self.db_url
        else:
            conninfo = (
                f"host={self.db_host} port={self.db_port} "
                f"dbname={self.db_name} user={self.db_user} password={self.db_password}"
            )
        logging.info("Connecting to Postgres at %s", self.db_url or self.db_host)
        try:
            return ConnectionPool(conninfo=conninfo, min_size=1, max_size=5, num_workers=2, timeout=30)
        except Exception as exc:
            logging.error("Failed to create Postgres connection pool: %s", exc)
            raise

    def _setup_mqtt(self):
        client = mqtt.Client(client_id="fence_service", clean_session=True)
        if self.mqtt_username:
            client.username_pw_set(self.mqtt_username, self.mqtt_password or None)
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        client.on_disconnect = self._on_disconnect

        client.connect(self.mqtt_host, self.mqtt_port, keepalive=60)
        client.loop_start()
        self.mqtt_client = client

    def _on_connect(self, client, _userdata, _flags, rc):
        if rc != 0:
            logging.error("Failed to connect to MQTT broker (rc=%s)", rc)
            return
        logging.info("Connected to MQTT broker %s:%d", self.mqtt_host, self.mqtt_port)
        try:
            client.subscribe(self.mqtt_topic, qos=self.mqtt_qos)
            logging.info("Subscribed to MQTT topic %s (QoS=%d)", self.mqtt_topic, self.mqtt_qos)
        except Exception as exc:
            logging.error("Failed to subscribe to %s: %s", self.mqtt_topic, exc)

    @staticmethod
    def _on_disconnect(_client, _userdata, rc):
        if rc != 0:
            logging.warning("Unexpected MQTT disconnect (rc=%s), client will auto-reconnect", rc)

    @staticmethod
    def _extract_camera_id_from_topic(topic: str) -> Optional[str]:
        if not topic:
            return None
        parts = topic.split("/")
        if len(parts) >= 3 and parts[0] == "vision" and parts[-1] == "detections":
            return parts[1]
        return None

    def _on_message(self, _client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except json.JSONDecodeError:
            logging.warning("Received invalid JSON on topic %s", msg.topic)
            return
        camera_id = payload.get("cameraId") or self._extract_camera_id_from_topic(msg.topic)
        if not camera_id:
            return
        camera_cfg = self.camera_map.get(camera_id)
        if not camera_cfg or not camera_cfg.fences:
            return

        detections = payload.get("detections") or []
        if not detections:
            return

        timestamp = parse_timestamp(payload.get("timestamp"))
        for detection in detections:
            self._handle_detection(camera_cfg, detection, timestamp)

    def _handle_detection(self, camera_cfg: CameraFenceConfig, detection: dict, timestamp: datetime):
        bbox = detection.get("bbox")
        if not bbox or len(bbox) != 4:
            return
        class_name = detection.get("class_name")
        if not class_name:
            return

        width = camera_cfg.width
        height = camera_cfg.height

        x1, y1, x2, y2 = [float(v) for v in bbox]
        normalized_bbox = all(0.0 <= v <= 1.0 for v in (x1, y1, x2, y2))

        center_x = (x1 + x2) / 2.0
        center_y = (y1 + y2) / 2.0
        if not normalized_bbox:
            if width <= 0 or height <= 0:
                return
            center_x = center_x / width
            center_y = center_y / height

        center_x = max(0.0, min(1.0, center_x))
        center_y = max(0.0, min(1.0, center_y))

        normalized_class = class_name.lower()
        score = detection.get("score")

        for fence in camera_cfg.fences:
            if not fence.enabled:
                continue
            if normalized_class not in fence.detect_objects:
                continue
            if not point_in_polygon(center_x, center_y, fence.points):
                continue
            if not self._should_emit_event(
                camera_cfg.camera_id,
                fence.name,
                normalized_class,
                center_x,
                center_y,
            ):
                continue
            self._store_event(camera_cfg.camera_id, class_name, score, timestamp)
            logging.info(
                "Fence %s triggered on camera %s by %s (score=%.3f)",
                fence.name,
                camera_cfg.camera_id,
                class_name,
                score or -1,
            )

    def _should_emit_event(
        self,
        camera_id: str,
        fence_name: str,
        class_name: str,
        center_x: float,
        center_y: float,
    ) -> bool:
        quant_x = round(center_x, self.position_digits) if self.position_digits >= 0 else center_x
        quant_y = round(center_y, self.position_digits) if self.position_digits >= 0 else center_y
        key = (camera_id, fence_name, class_name, quant_x, quant_y)
        now = time.time()
        last = self.last_trigger.get(key)
        if last and now - last < self.cooldown_seconds:
            return False
        self.last_trigger[key] = now
        return True

    def _store_event(self, camera_id: str, class_name: str, score: Optional[float], timestamp: datetime):
        if not self.db_pool:
            return
        event_id = f"evt_{uuid.uuid4().hex[:12]}"
        try:
            with self.db_pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO events (id, camera_id, class_name, ts, thumbnail, score)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (event_id, camera_id, class_name, timestamp, None, score),
                    )
        except Exception as exc:
            logging.error("Failed to insert event into Postgres: %s", exc)

    def load_camera_config(self) -> Dict[str, CameraFenceConfig]:
        try:
            with open(self.cameras_json, "r", encoding="utf-8") as fp:
                data = json.load(fp)
        except FileNotFoundError:
            logging.error("cameras.json not found at %s", self.cameras_json)
            return {}
        except json.JSONDecodeError as exc:
            logging.error("Failed to parse cameras.json: %s", exc)
            return {}

        cameras_data = data.get("cameras", [])
        camera_map: Dict[str, CameraFenceConfig] = {}
        for camera in cameras_data:
            camera_id = camera.get("id")
            if not camera_id:
                continue
            fences_data = camera.get("virtualFences") or []
            if not fences_data:
                continue

            resolution = camera.get("resolution")
            res = parse_resolution(resolution) if resolution else None
            if not res:
                logging.warning("Camera %s missing valid resolution, skipping fences", camera_id)
                continue
            width, height = res

            parsed_fences: List[VirtualFence] = []
            for fence_data in fences_data:
                if not fence_data.get("enabled", True):
                    continue
                points = normalize_points(fence_data.get("points") or [], width, height)
                if len(points) < 3:
                    logging.warning(
                        "Camera %s fence %s ignored because it has <3 points",
                        camera_id,
                        fence_data.get("name", "<unnamed>"),
                    )
                    continue
                detect_objects = [str(obj).lower() for obj in fence_data.get("detectObjects", []) if obj]
                if not detect_objects:
                    logging.warning(
                        "Camera %s fence %s ignored because detectObjects is empty",
                        camera_id,
                        fence_data.get("name", "<unnamed>"),
                    )
                    continue
                parsed_fences.append(
                    VirtualFence(
                        name=fence_data.get("name", "Zone"),
                        points=points,
                        detect_objects=detect_objects,
                        enabled=True,
                    )
                )

            if parsed_fences:
                camera_map[camera_id] = CameraFenceConfig(
                    camera_id=camera_id,
                    width=width,
                    height=height,
                    fences=parsed_fences,
                )
                logging.info("Loaded %d fences for camera %s", len(parsed_fences), camera_id)
        return camera_map


def main():
    service = FenceService()

    def _signal_handler(signum, _frame):
        logging.info("Received signal %s, shutting down fence service", signum)
        service.stop()

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    try:
        service.start()
    except KeyboardInterrupt:
        service.stop()
    except Exception as exc:
        logging.error("Fence service stopped due to error: %s", exc)
        service.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()
