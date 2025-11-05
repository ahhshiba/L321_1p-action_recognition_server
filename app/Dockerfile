FROM python:3.11-slim

# Alder Lake 用 iHD driver
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 LIBVA_DRIVER_NAME=iHD

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libva2 vainfo libdrm2 intel-media-va-driver ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY app/requirements.txt /app/
RUN pip install -r requirements.txt

COPY app/action_recognition_server.py /app/
COPY app/entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
