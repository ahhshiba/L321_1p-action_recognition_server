Action Recognition Server Stack
一組可在本地模擬的人體行為辨識串流系統。專案透過 docker-compose 啟動一整套流水線：

raw_restreamer 以 FFmpeg 轉推 USB 攝影機 (/dev/video0) 到 go2rtc。
app/action_recognition_server.py 拉取 cam1_raw 串流、在畫面上疊加行為辨識結果，並重新輸出成 cam1_overlay。
go2rtc 將 RTSP 串流轉成 WebRTC/HTTP 以供使用者端播放。
兩個前端 (html_test 與 html16) 讀取 share/*.json 描述的相機/事件/錄影資訊並呈現成儀表板。
目前 draw_overlay 是示範邏輯，只會畫出固定框與標籤；在實務中請把行為辨識模型的結果寫進這個函式。

特色
💡 端到端資料流：從實體攝影機 → 行為辨識覆寫 → WebRTC 播放。
🧱 模組化服務：每個元件皆為獨立容器，可單獨開發或替換。
📂 可攜測試資料：share/ 內含範例 cameras.json、events.json 與快照，方便前端離線展示。
🧑‍💻 支援硬體加速：action_recognition_server 會偵測 /dev/dri，自動切換 VAAPI 編碼。
🌐 完整控管界面：Next.js 16 儀表板 (html16) 具備相機配置、事件/錄影瀏覽與刪除操作。
系統架構
/dev/video0 → raw_restreamer → go2rtc (cam1_raw)
                                     ↓
                        action_recognition_server → go2rtc (cam1_overlay)
                                     ↓
                                  Web UI (html16 / html_test)
資料交換：share/ 作為 events/recordings/cameras 的共享資料夾，會以唯讀方式掛載給 Python 服務、以讀寫方式掛載給前端。
go2rtc：go2rtc/go2rtc-config.yaml 定義 RTSP/WebRTC 端口 (8554/8555) 與預設串流。
網頁：
html_test：最輕量的 Nginx 靜態頁，顯示基本播放器。
html16：Next.js 16 App Router 介面，支援 server actions 寫入設定（儲存於 html16/config/cameras.json）。
專案結構
路徑	說明
app/	Python 行為辨識轉推程式、Dockerfile 與進入點。
share/	測試資料 (cameras.json、events.json、recordings.json、縮圖)。
go2rtc/	go2rtc 設定檔。
html_test/	Nginx 靜態頁面範例。
html16/	Next.js 16 儀表板專案，可單獨開發/部署。
docker-compose.yml	啟動所有服務的組態。
環境需求
Docker 24+ / Docker Compose v2。
具備 /dev/video0 的 Linux 主機（若沒有可改用其他 RTSP 來源）。
可選：Intel iGPU + VAAPI (/dev/dri/renderD128) 以取得硬體編碼效能。
快速開始
調整 share 與設定
編輯 share/cameras.json 內的 rtspUrl / streamUrl 以符合實際攝影機。
若需自訂事件/錄影樣本，可修改 share/events.json 與 share/recordings.json，並把對應縮圖放入 share/events/ 或 share/recordings/。
optional：修改 go2rtc/go2rtc-config.yaml 以註冊多支串流。
設定環境變數
app/.env 控制 action_recognition_server 的輸入輸出串流、解析度、重連策略與顯示開關。
ACTION_HWACCEL（於 docker-compose 或 shell 設定）控制編碼策略：auto / vaapi / none。預設會自動檢查 /dev/dri。
啟動
docker compose up -d --build
docker compose logs -f action_recognition_server
使用
go2rtc Web UI：http://localhost:1984
WebRTC 播放（Next.js 儀表板）：http://localhost:3000
傳統靜態頁：http://localhost:8080
服務說明
raw_restreamer
基於 jrottenberg/ffmpeg:6.1-ubuntu，從 /dev/video0 取得 640×480 10 FPS 的 YUYV 影像並推送至 rtsp://go2rtc:8554/cam1_raw。
若沒有實體攝影機，可把 devices 與 command 改為其他 RTSP/影片來源。
action_recognition_server
app/action_recognition_server.py 使用 OpenCV 拉 cam1_raw、自動調整大小並呼叫 draw_overlay。
透過子行程 ffmpeg 重新編碼、推到 cam1_overlay。
Core 參數：
參數	來源	功能
--in/IN_URL	app/.env	輸入 RTSP
--out/OUT_URL	app/.env	輸出 RTSP
--hwaccel/ACTION_HWACCEL	環境變數	auto/vaapi/none
--vaapi_device/VAAPI_DEVICE	環境變數	預設 /dev/dri/renderD128
--max_open_retries	CLI	若連線失敗會退出。
在 draw_overlay 中串接實際的行為辨識模型即可把結果畫到畫面上。
go2rtc
暴露埠：1984 (HTTP / Web UI)、8554 (RTSP)、8555 (WebRTC TCP/UDP)。
go2rtc/go2rtc-config.yaml 中的 streams.cam1_raw 與 streams.cam1_overlay 會回環到 docker-compose 內的服務。
html16（Next.js 16）
Server Actions (app/actions/*.ts) 透過 fs 讀寫 share/events.json 與 share/recordings.json，可以在 UI 直接新增/刪除事件。
CAMERAS_JSON/EVENTS_JSON/RECORDINGS_JSON 等環境變數會在 docker-compose 中掛上 /app/share/*.json，方便在容器內更新資料。
常見指令：
cd html16
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run build && npm start
html_test
極簡 Nginx 伺服器，使用 html_test/index.html 作為靜態頁，適合快速驗證 RTSP/WebRTC 串流。
開發建議
只開前端：若已有遠端 go2rtc，可在 html16/.env.local 設定 GO2RTC_API_URL 與 NEXT_PUBLIC_GO2RTC_URL，接著 npm run dev 即可。
調整示範疊圖：在 draw_overlay 中串接模型輸出，或在 app/share 中維護一組 metadata 由 Python 讀取並顯示。
新增相機：
在 go2rtc/go2rtc-config.yaml 新增 stream 定義。
更新 docker-compose.yml（必要時）與 share/cameras.json。
重啟 go2rtc 與 action_recognition_server。
疑難排解
action_recognition_server 反覆重啟：確認 cam1_raw 是否存在；透過 docker compose logs raw_restreamer 或 ffplay rtsp://localhost:8554/cam1_raw 測試。
VAAPI 啟動失敗：確保主機載入 i915 驅動並把 /dev/dri 掛入容器；或把 ACTION_HWACCEL=none 改用軟編碼。
Web UI 沒有事件資料：檢查 share/events.json 是否掛載為 :rw；必要時賦予主機檔案寫入權限。
go2rtc 播放卡住：確認主機網路可達，並檢查 GO2RTC_CANDIDATE 是否設為主機 IP（避免 WebRTC 使用 127.0.0.1）。
下一步
將實際的行為辨識模型推理程式碼整合進 draw_overlay 或直接在 Python 服務中推送偵測結果至資料夾供前端讀取。
擴充 html16 的設定頁面，讓事件/錄影直接連動後端儲存區（NFS、S3 等）。
