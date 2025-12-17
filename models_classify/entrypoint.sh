#!/usr/bin/env bash
set -e

export CAMERAS_JSON="${CAMERAS_JSON:-/app/share/cameras.json}"
export MODELS_JSON="${MODELS_JSON:-/app/share/models.json}"


exec python /app/launcher.py
