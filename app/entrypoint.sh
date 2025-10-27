#!/usr/bin/env bash
set -e

IN_URL="${IN_URL:-rtsp://mediamtx:8554/cam1_raw}"
OUT_URL="${OUT_URL:-rtsp://mediamtx:8554/cam1_overlay}"
W="${W:-1280}"
H="${H:-720}"
FPS="${FPS:-15}"
RECONNECT_SEC="${RECONNECT_SEC:-2.0}"
TCP_PULL="${TCP_PULL:-1}"
SHOW="${SHOW:-0}"
MAX_OPEN_RETRIES="${MAX_OPEN_RETRIES:-10}"

ARGS=( --in "$IN_URL" --out "$OUT_URL" --w "$W" --h "$H" --fps "$FPS" \
       --reconnect_sec "$RECONNECT_SEC" --max_open_retries "$MAX_OPEN_RETRIES" )

[ "$TCP_PULL" = "1" ] && ARGS+=( --tcp_pull )
[ "$SHOW" = "1" ] && ARGS+=( --show )

exec python3 /app/action_recognition_server.py "${ARGS[@]}"
