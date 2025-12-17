FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

COPY models_classify/requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt

COPY models_classify/launcher.py /app/launcher.py
COPY models_classify/entrypoint.sh /app/entrypoint.sh
COPY models_classify/runner /runner

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
