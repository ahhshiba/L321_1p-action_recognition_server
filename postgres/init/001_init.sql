CREATE TABLE IF NOT EXISTS events (
  id           text PRIMARY KEY,            -- "evt_003"
  camera_id    text NOT NULL,               -- "cam1"
  class_name   text NOT NULL,               -- "package"（class 是保留字，建議用 class_name）
  ts           timestamptz NOT NULL,         -- "2025-01-30T12:10:45Z"
  thumbnail    text,                         -- "evt_003.jpg"（建議存相對路徑或URL）
  score        double precision,             -- 0.88
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_camera_ts
  ON events(camera_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_class_ts
  ON events(class_name, ts DESC);
