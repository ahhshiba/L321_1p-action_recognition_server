# go2rtc direct playback demo

這個目錄提供一個極簡範例頁面 (`index.html`)，展示在瀏覽器中使用 go2rtc `stream.mp4` 的兩種播放方式：

- Progressive MP4：直接將 `stream.mp4` 指給 `<video>`。
- Media Source Extensions (MSE)：透過 JavaScript 手動串流 `stream.mp4` 到 SourceBuffer。

## 快速啟動

```bash
cd html_test
docker compose up -d
```

啟動後：

- 測試頁面：<http://localhost:8080>
- go2rtc API：透過同網域代理 <http://localhost:8080/api/>（容器內仍連線到 go2rtc:1984）

如需修改串流來源，可編輯專案根目錄的 `go2rtc-config.yaml`，或在頁面上直接調整 API 與 stream 名稱。

MSE 播放需要瀏覽器支援 MediaSource API，且必須輸入正確的 MIME/codec 參數（預設為 AVC/AAC）。
