# Docker 部署指南

本專案支援使用 Docker 和 Docker Compose 進行部署。

## 快速開始

### 1. 準備 go2rtc 配置檔

建立 `go2rtc.yaml` 檔案：

\`\`\`yaml
api:
  listen: ":1984"

rtsp:
  listen: ":8554"

streams:
  cam1_overlay:
    - rtsp://your_camera_ip/stream1
  cam2_overlay:
    - rtsp://your_camera_ip/stream2
\`\`\`

### 2. 啟動服務

\`\`\`bash
# 建置並啟動所有服務
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down
\`\`\`

### 3. 訪問應用程式

- Web 介面：http://localhost:3000
- go2rtc API：http://localhost:1984
- go2rtc Web UI：http://localhost:1984/

## 配置說明

### 環境變數

在 `docker-compose.yml` 中可以配置以下環境變數：

- `GO2RTC_API_URL`: 後端連接 go2rtc 的 URL（容器內部網路）
- `NEXT_PUBLIC_GO2RTC_URL`: 前端連接 go2rtc 的 URL（瀏覽器訪問）

### 網路配置

服務之間透過 Docker 網路 `frigate-network` 通訊：
- Web 介面透過 `http://go2rtc:1984` 連接到 go2rtc（容器內部）
- 瀏覽器透過 `http://localhost:1984` 連接到 go2rtc（主機端口映射）

### 持久化資料

如需持久化相機配置，可以在 `docker-compose.yml` 中添加 volume：

\`\`\`yaml
services:
  web:
    volumes:
      - ./data:/app/data
\`\`\`

## 開發模式

如果需要在 Docker 中進行開發：

\`\`\`bash
# 使用開發模式的 docker-compose
docker-compose -f docker-compose.dev.yml up
\`\`\`

建立 `docker-compose.dev.yml`：

\`\`\`yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
\`\`\`

## 故障排除

### 無法連接到 go2rtc

1. 檢查 go2rtc 是否正在運行：
   \`\`\`bash
   docker-compose ps
   \`\`\`

2. 檢查 go2rtc 日誌：
   \`\`\`bash
   docker-compose logs go2rtc
   \`\`\`

3. 測試 go2rtc API：
   \`\`\`bash
   curl http://localhost:1984/api/streams
   \`\`\`

### Web 介面無法啟動

1. 檢查建置日誌：
   \`\`\`bash
   docker-compose logs web
   \`\`\`

2. 重新建置映像：
   \`\`\`bash
   docker-compose build --no-cache web
   docker-compose up -d web
   \`\`\`

## 生產環境部署

### 使用反向代理（Nginx）

建議在生產環境中使用 Nginx 作為反向代理：

\`\`\`nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/go2rtc/ {
        proxy_pass http://localhost:1984/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
\`\`\`

### 安全性建議

1. 使用 HTTPS（Let's Encrypt）
2. 設定防火牆規則
3. 限制 go2rtc API 訪問
4. 定期更新 Docker 映像
