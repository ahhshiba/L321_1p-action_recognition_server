-- Create events table for storing recording/event metadata
CREATE TABLE IF NOT EXISTS events (
  id           text PRIMARY KEY,                -- "evt_003"
  camera_id    text NOT NULL,                   -- "cam1"
  class_name   text NOT NULL,                   -- "package"
  ts           timestamptz NOT NULL,            -- "2025-01-30T12:10:45Z"
  thumbnail    text,                            -- "evt_003.jpg" (filename only)
  video_path   text,                            -- "evt_003.mkv" (filename only, stored in EVENTS_DIR)
  score        double precision,                -- 0.88
  duration     text,                            -- "00:45" or "1m 30s"
  size         text,                            -- "12.5 MB"
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_events_camera_ts
  ON events(camera_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_class_ts
  ON events(class_name, ts DESC);
