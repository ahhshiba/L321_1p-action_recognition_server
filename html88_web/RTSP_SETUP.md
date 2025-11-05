# RTSP 串流設定指南

## 概述

go2rtc 支援兩種 RTSP 串流方式：

1. **發布模式 (Publish)**: 您的串流源推送到 go2rtc
2. **拉取模式 (Pull)**: go2rtc 從串流源拉取

## 發布模式設定 (推薦用於本地串流)

### 1. go2rtc 配置

`go2rtc.yaml` 已設定為接收發布的串流：

\`\`\`yaml
rtsp:
  listen: ":8554"
  strict: "false"
  publish:
    - username: publisher
      password: secret

# 不需要定義 streams - go2rtc 會在接收發布時自動註冊
# 這樣可以避免與動態註冊產生衝突
\`\`\`

### 2. 發布串流到 go2rtc

從您的串流源（例如 FFmpeg、OBS、相機）推送到：

\`\`\`bash
rtsp://publisher:secret@127.0.0.1:8554/cam1_raw
\`\`\`

**FFmpeg 範例：**
\`\`\`bash
ffmpeg -i input.mp4 -c copy -f rtsp \
  rtsp://publisher:secret@127.0.0.1:8554/cam1_raw
\`\`\`

**OBS 設定：**
- 串流伺服器: `rtsp://127.0.0.1:8554/cam1_raw`
- 串流金鑰: `publisher:secret`

### 3. 驗證串流

檢查 go2rtc 是否收到串流：

\`\`\`bash
curl http://127.0.0.1:1984/api/streams
\`\`\`

應該會看到：
\`\`\`json
{
  "cam1_raw": {
    "producers": [...],
    "consumers": [...]
  }
}
\`\`\`

### 4. 在網頁介面新增相機

1. 開啟網頁介面
2. 點擊「Add Camera」
3. 輸入：
   - Camera Name: `cam1_raw` (與發布的串流名稱相同)
   - RTSP URL: `rtsp://publisher:secret@127.0.0.1:8554/cam1_raw`
4. 點擊「Add Camera」

**重要：** 系統會自動檢查串流是否已存在。如果串流已在發布中，會直接使用現有串流，不會重複註冊造成衝突。

## 拉取模式設定 (用於外部相機)

如果您的相機已經有 RTSP 伺服器，go2rtc 可以從它拉取：

\`\`\`yaml
streams:
  external_cam:
    - rtsp://username:password@192.168.1.100:554/stream1
\`\`\`

## 常見問題

### 問題：go2rtc 顯示 "i/o timeout"

**原因：** 串流源沒有正確推送到 go2rtc

**解決方案：**
1. 確認串流源正在推送
2. 檢查 RTSP URL 是否正確（port 8554，不是 8556）
3. 確認認證資訊正確（publisher:secret）
4. 檢查防火牆設定

### 問題：網頁顯示 "Video error"

**原因：** go2rtc 沒有該串流的資料

**解決方案：**
1. 先確認 go2rtc 收到串流：`curl http://127.0.0.1:1984/api/streams`
2. 確認串流名稱與網頁設定一致
3. 檢查瀏覽器 console 的錯誤訊息

### 問題：網頁新增相機後原本的畫面消失

**原因：** 在 go2rtc.yaml 中靜態定義串流，又透過網頁 API 動態註冊，導致衝突

**解決方案：**
1. 從 go2rtc.yaml 移除 `streams` 區段中的靜態定義
2. 讓 go2rtc 在接收發布時自動註冊串流
3. 重啟 go2rtc：`docker-compose restart go2rtc`
4. 系統已更新為自動檢測現有串流，避免重複註冊

### 問題：Port 衝突

如果 port 8554 已被佔用，修改 `go2rtc.yaml`：

\`\`\`yaml
rtsp:
  listen: ":8555"  # 改用其他 port
\`\`\`

記得同時更新發布 URL：
\`\`\`
rtsp://publisher:secret@127.0.0.1:8555/cam1_raw
\`\`\`

## Docker 環境注意事項

在 Docker 環境中，使用容器名稱而非 localhost：

\`\`\`yaml
# 如果需要拉取模式，使用容器名稱
streams:
  external_cam:
    - rtsp://username:password@camera-host:554/stream
\`\`\`

發布時使用 host 的 IP 或 port mapping。

## 測試流程

1. **啟動 go2rtc**
   \`\`\`bash
   docker-compose up -d go2rtc
   \`\`\`

2. **發布測試串流**
   \`\`\`bash
   ffmpeg -re -i test.mp4 -c copy -f rtsp \
     rtsp://publisher:secret@127.0.0.1:8554/test_stream
   \`\`\`

3. **檢查串流**
   \`\`\`bash
   curl http://127.0.0.1:1984/api/streams
   # 應該看到 test_stream
   \`\`\`

4. **在網頁播放**
   - 開啟 http://localhost:3000
   - 新增相機：名稱 `test_stream`
   - 應該會看到即時畫面
