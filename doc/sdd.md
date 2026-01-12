# 軟體設計文件 (SDD)

## AI Hub - 智慧視覺串流平台

---

**文件版本**: v1.0  
**建立日期**: 2025-12-29  
**狀態**: 初版

---

## 目錄

1. [簡介](#1-簡介)
2. [系統架構設計](#2-系統架構設計)
3. [模組設計](#3-模組設計)
4. [資料設計](#4-資料設計)
5. [介面設計](#5-介面設計)
6. [部署設計](#6-部署設計)
7. [安全設計](#7-安全設計)
8. [附錄](#8-附錄)

---

<div style="page-break-before: always;"></div>

## 1. 簡介

### 1.1 目的

本文件為 **AI Hub** 的軟體設計文件 (Software Design Document, SDD)，詳細描述系統的架構設計、模組設計、資料設計與介面設計，作為開發實作的依據。

### 1.2 範圍

本文件涵蓋：
- 微服務架構設計
- 各服務模組的類別與函式設計
- 資料庫與配置檔設計
- API 與 MQTT 介面設計
- Docker 容器化部署設計

### 1.3 參考文件

| 文件 | 版本 |
|------|------|
| prd_internal.md | v1.0 |
| srs.md | v1.0 |

---

## 2. 系統架構設計

### 2.1 架構概述

系統採用 **微服務架構 (Microservices Architecture)**，各服務獨立運行於 Docker 容器，透過 MQTT 進行事件驅動通訊。

### 2.2 架構圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI Hub System                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Presentation Layer                           │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    html16 (Next.js 16)                       │    │    │
│  │  │              Web Dashboard / REST API / WebSocket            │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Streaming Layer                              │    │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │    │
│  │  │ raw_restreamer│───►│    go2rtc     │◄───│action_recog   │       │    │
│  │  │   (FFmpeg)    │    │ (RTSP/HLS/WS) │    │   _server     │       │    │
│  │  └───────────────┘    └───────────────┘    └───────────────┘       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Processing Layer                             │    │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │    │
│  │  │model_launcher │    │     fence     │    │    record     │       │    │
│  │  │  (YOLOv8)     │    │ (Ray Casting) │    │   (FFmpeg)    │       │    │
│  │  └───────────────┘    └───────────────┘    └───────────────┘       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Infrastructure Layer                         │    │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │    │
│  │  │     mqtt      │    │   postgres    │    │   File System │       │    │
│  │  │ (Mosquitto 2) │    │ (PostgreSQL)  │    │  (recordings) │       │    │
│  │  └───────────────┘    └───────────────┘    └───────────────┘       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 分層說明

| 層級 | 服務 | 職責 |
|------|------|------|
| **Presentation** | html16 | Web UI、REST API、WebSocket |
| **Streaming** | raw_restreamer, go2rtc, action_recognition | 串流擷取、轉碼、分發 |
| **Processing** | model_launcher, fence, record | AI 推論、事件偵測、錄影 |
| **Infrastructure** | mqtt, postgres, filesystem | 訊息佇列、資料庫、檔案儲存 |

### 2.4 通訊模式

```
┌─────────────────────────────────────────────────────────────────┐
│                        Communication Patterns                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Streaming (RTSP)                                            │
│     raw_restreamer ──RTSP──► go2rtc ──HLS──► Browser            │
│                                                                  │
│  2. Event-Driven (MQTT)                                         │
│     model_launcher ──detections──► fence ──events──► record     │
│                          │                    │                  │
│                          └────────────────────┼──► html16        │
│                                               │                  │
│  3. Request-Response (HTTP/SQL)                                 │
│     html16 ──REST──► postgres                                   │
│     html16 ──HTTP──► go2rtc API                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 服務依賴圖

```
                    ┌─────────────┐
                    │   html16    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   go2rtc    │ │  postgres   │ │    mqtt     │
    └──────┬──────┘ └─────────────┘ └──────┬──────┘
           │                               │
    ┌──────┴──────┐               ┌────────┼────────┐
    │             │               │        │        │
    ▼             ▼               ▼        ▼        ▼
┌────────┐  ┌──────────┐    ┌────────┐ ┌───────┐ ┌───────┐
│raw_    │  │action_   │    │model_  │ │ fence │ │record │
│restream│  │recogn    │    │launcher│ │       │ │       │
└────────┘  └──────────┘    └────────┘ └───────┘ └───────┘
```

---

<div style="page-break-before: always;"></div>

## 3. 模組設計

### 3.1 raw_restreamer 模組

#### 3.1.1 模組概述

| 項目 | 內容 |
|------|------|
| 語言 | Shell + FFmpeg |
| 職責 | USB 攝影機擷取與 RTSP 轉推 |
| 輸入 | /dev/video0 |
| 輸出 | rtsp://go2rtc:8554/cam_raw |

#### 3.1.2 流程圖

```
┌─────────────────────────────────────────────────────────────┐
│                    raw_restreamer                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ 讀取配置 │───►│偵測裝置 │───►│啟動FFmpeg│───►│監控程序 │  │
│  └─────────┘    └─────────┘    └─────────┘    └────┬────┘  │
│                                                     │       │
│                                              ┌──────┴─────┐ │
│                                              │ 異常? 重啟 │ │
│                                              └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.3 FFmpeg 命令

```bash
ffmpeg -f v4l2 -input_format yuyv422 \
  -video_size ${RESOLUTION} -framerate ${FPS} \
  -i /dev/video0 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -b:v 2000k -maxrate 2500k -bufsize 5000k \
  -f rtsp -rtsp_transport tcp \
  rtsp://go2rtc:8554/cam1_raw
```

---

### 3.2 action_recognition_server 模組

#### 3.2.1 模組概述

| 項目 | 內容 |
|------|------|
| 語言 | Python 3.10 |
| 框架 | OpenCV, asyncio |
| 職責 | 拉取串流、疊加 AI 結果、推送疊加串流 |

#### 3.2.2 類別圖

```
┌─────────────────────────────────────────────────────────────┐
│                ActionRecognitionServer                       │
├─────────────────────────────────────────────────────────────┤
│ - rtsp_input: str                                           │
│ - rtsp_output: str                                          │
│ - mqtt_client: MQTTClient                                   │
│ - detection_cache: Dict[str, Detection]                     │
│ - ffmpeg_process: subprocess.Popen                          │
├─────────────────────────────────────────────────────────────┤
│ + __init__(config: Config)                                  │
│ + start() -> None                                           │
│ + stop() -> None                                            │
│ - _connect_rtsp() -> cv2.VideoCapture                       │
│ - _start_ffmpeg_output() -> subprocess.Popen                │
│ - _on_detection(msg: MQTTMessage) -> None                   │
│ - _draw_overlay(frame: np.ndarray) -> np.ndarray            │
│ - _process_loop() -> None                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ uses
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Detection                               │
├─────────────────────────────────────────────────────────────┤
│ + class_name: str                                           │
│ + bbox: Tuple[float, float, float, float]                   │
│ + score: float                                              │
│ + center: Tuple[float, float]                               │
│ + timestamp: datetime                                        │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.3 核心函式

```python
class ActionRecognitionServer:
    
    def _draw_overlay(self, frame: np.ndarray) -> np.ndarray:
        """繪製 AI 偵測結果疊加層"""
        h, w = frame.shape[:2]
        
        for det in self.detection_cache.values():
            # 轉換正規化座標為像素座標
            x1, y1, x2, y2 = det.bbox
            px1, py1 = int(x1 * w), int(y1 * h)
            px2, py2 = int(x2 * w), int(y2 * h)
            
            # 繪製邊界框
            color = self._get_class_color(det.class_name)
            cv2.rectangle(frame, (px1, py1), (px2, py2), color, 2)
            
            # 繪製標籤
            label = f"{det.class_name} {det.score:.0%}"
            cv2.putText(frame, label, (px1, py1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        return frame
    
    async def _process_loop(self) -> None:
        """主處理迴圈"""
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                await self._reconnect()
                continue
            
            # 疊加 AI 結果
            frame = self._draw_overlay(frame)
            
            # 寫入 FFmpeg 輸出
            self.ffmpeg_process.stdin.write(frame.tobytes())
```

---

### 3.3 model_launcher 模組

#### 3.3.1 模組概述

| 項目 | 內容 |
|------|------|
| 語言 | Python 3.10 |
| 框架 | Ultralytics YOLOv8 |
| 職責 | 動態載入模型、執行推論、發布結果 |

#### 3.3.2 類別圖

```
┌─────────────────────────────────────────────────────────────┐
│                     ModelLauncher                            │
├─────────────────────────────────────────────────────────────┤
│ - models_config: Dict                                       │
│ - cameras_config: Dict                                      │
│ - runners: Dict[str, InferenceRunner]                       │
│ - mqtt_client: MQTTClient                                   │
├─────────────────────────────────────────────────────────────┤
│ + __init__(config_path: str)                                │
│ + start() -> None                                           │
│ + stop() -> None                                            │
│ + reload_config() -> None                                   │
│ - _match_model(camera: Camera) -> Model                     │
│ - _start_runner(camera: Camera, model: Model) -> None       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ creates
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    InferenceRunner                           │
├─────────────────────────────────────────────────────────────┤
│ - camera_id: str                                            │
│ - model: YOLO                                               │
│ - rtsp_url: str                                             │
│ - mqtt_client: MQTTClient                                   │
│ - running: bool                                             │
├─────────────────────────────────────────────────────────────┤
│ + __init__(camera_id, model_path, rtsp_url, mqtt)           │
│ + run() -> None                                             │
│ + stop() -> None                                            │
│ - _inference(frame: np.ndarray) -> List[Detection]          │
│ - _publish_detections(detections: List[Detection]) -> None  │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.3 推論流程

```python
class InferenceRunner:
    
    def run(self) -> None:
        """推論主迴圈"""
        cap = cv2.VideoCapture(self.rtsp_url)
        
        while self.running:
            ret, frame = cap.read()
            if not ret:
                time.sleep(1)
                continue
            
            # YOLOv8 推論
            results = self.model.predict(
                frame,
                conf=self.confidence,
                iou=self.iou,
                verbose=False
            )
            
            # 解析結果
            detections = self._parse_results(results[0])
            
            # 發布 MQTT
            self._publish_detections(detections)
    
    def _parse_results(self, result) -> List[Detection]:
        """解析 YOLOv8 結果"""
        detections = []
        boxes = result.boxes
        
        for i in range(len(boxes)):
            xyxyn = boxes.xyxyn[i].tolist()  # 正規化座標
            cls_id = int(boxes.cls[i])
            score = float(boxes.conf[i])
            
            detections.append(Detection(
                class_name=self.class_names[cls_id],
                bbox=xyxyn,
                score=score,
                center=((xyxyn[0]+xyxyn[2])/2, (xyxyn[1]+xyxyn[3])/2)
            ))
        
        return detections
```

---

### 3.4 fence 模組

#### 3.4.1 模組概述

| 項目 | 內容 |
|------|------|
| 語言 | Python 3.10 |
| 框架 | paho-mqtt, psycopg2 |
| 職責 | 監聽偵測結果、判斷入侵、產生事件 |

#### 3.4.2 類別圖

```
┌─────────────────────────────────────────────────────────────┐
│                      FenceService                            │
├─────────────────────────────────────────────────────────────┤
│ - cameras: Dict[str, Camera]                                │
│ - cooldowns: Dict[str, datetime]                            │
│ - mqtt_client: MQTTClient                                   │
│ - db_conn: psycopg2.Connection                              │
├─────────────────────────────────────────────────────────────┤
│ + __init__(config_path: str)                                │
│ + start() -> None                                           │
│ + stop() -> None                                            │
│ - _on_detection(msg: MQTTMessage) -> None                   │
│ - _check_intrusion(camera_id, detection) -> Optional[Event] │
│ - _point_in_polygon(point, polygon) -> bool                 │
│ - _is_in_cooldown(fence_id, class_name) -> bool             │
│ - _save_event(event: Event) -> None                         │
│ - _publish_event(event: Event) -> None                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ uses
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     VirtualFence                             │
├─────────────────────────────────────────────────────────────┤
│ + id: str                                                   │
│ + name: str                                                 │
│ + enabled: bool                                             │
│ + points: List[Point]                                       │
│ + detect_objects: List[str]                                 │
│ + alert_level: str                                          │
├─────────────────────────────────────────────────────────────┤
│ + contains(point: Point) -> bool                            │
│ + should_detect(class_name: str) -> bool                    │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4.3 Ray Casting 演算法

```python
def _point_in_polygon(self, point: Tuple[float, float], 
                       polygon: List[Dict]) -> bool:
    """
    Ray Casting Algorithm
    從點向右發射射線，計算與多邊形邊的交點數
    奇數 = 內部，偶數 = 外部
    """
    x, y = point
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]['x'], polygon[i]['y']
        xj, yj = polygon[j]['x'], polygon[j]['y']
        
        if ((yi > y) != (yj > y)) and \
           (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    
    return inside
```

#### 3.4.4 冷卻狀態機

```
        ┌──────────────────────────────────────────────┐
        │              Cooldown State Machine           │
        └──────────────────────────────────────────────┘

                    物件進入圍欄
        ┌─────┐  ─────────────────►  ┌─────────┐
        │IDLE │                      │ ACTIVE  │
        └─────┘  ◄─────────────────  └────┬────┘
            ▲     冷卻期結束              │
            │                             │ 觸發事件
            │                             ▼
            │                       ┌──────────┐
            │   離開 > LEAVE_SEC    │ COOLDOWN │
            └───────────────────────┴──────────┘
```

---

### 3.5 record 模組

#### 3.5.1 模組概述

| 項目 | 內容 |
|------|------|
| 語言 | Python 3.10 |
| 框架 | FFmpeg subprocess, paho-mqtt |
| 職責 | 持續錄影、緩衝錄影、事件裁剪 |

#### 3.5.2 類別圖

```
┌─────────────────────────────────────────────────────────────┐
│                     RecordService                            │
├─────────────────────────────────────────────────────────────┤
│ - cameras: Dict[str, Camera]                                │
│ - recorders: Dict[str, ContinuousRecorder]                  │
│ - buffers: Dict[str, BufferRecorder]                        │
│ - mqtt_client: MQTTClient                                   │
├─────────────────────────────────────────────────────────────┤
│ + __init__(config_path: str)                                │
│ + start() -> None                                           │
│ + stop() -> None                                            │
│ - _on_event(msg: MQTTMessage) -> None                       │
│ - _clip_event(event: Event) -> str                          │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼                               ▼
┌───────────────────────┐     ┌───────────────────────┐
│  ContinuousRecorder   │     │    BufferRecorder     │
├───────────────────────┤     ├───────────────────────┤
│ - camera_id: str      │     │ - camera_id: str      │
│ - segment_seconds: int│     │ - buffer_seconds: int │
│ - ffmpeg: Popen       │     │ - segment_seconds: int│
├───────────────────────┤     ├───────────────────────┤
│ + start() -> None     │     │ + start() -> None     │
│ + stop() -> None      │     │ + stop() -> None      │
│ - _get_output_path()  │     │ - _cleanup_old()      │
└───────────────────────┘     └───────────────────────┘
```

#### 3.5.3 事件裁剪流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Clipping Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 接收事件 MQTT                                            │
│     └─► event_id, camera_id, timestamp                       │
│                                                              │
│  2. 計算裁剪範圍                                              │
│     └─► [ts - PRE_SEC, ts + POST_SEC]                        │
│                                                              │
│  3. 等待「事後」時間經過                                       │
│     └─► await asyncio.sleep(POST_SEC + GRACE)                │
│                                                              │
│  4. 收集緩衝片段                                              │
│     └─► buffer/{camera}/YYYY-MM/DD/*.ts                      │
│                                                              │
│  5. FFmpeg 串接與裁剪                                         │
│     └─► ffmpeg -i concat:... -ss ... -t ... output.mkv      │
│                                                              │
│  6. 更新資料庫                                                │
│     └─► UPDATE events SET video_path = ... WHERE id = ...    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.6 html16 (Web UI) 模組

#### 3.6.1 模組概述

| 項目 | 內容 |
|------|------|
| 語言 | TypeScript |
| 框架 | Next.js 16 + React 18 |
| 狀態管理 | React Context + SWR |

#### 3.6.2 目錄結構

```
html16/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # 根佈局
│   ├── page.tsx             # 首頁 (儀表板)
│   ├── cameras/
│   │   ├── page.tsx         # 攝影機列表
│   │   └── [id]/
│   │       ├── page.tsx     # 攝影機詳情
│   │       └── edit/page.tsx # 編輯頁面
│   ├── events/
│   │   └── page.tsx         # 事件列表
│   ├── recordings/
│   │   └── page.tsx         # 錄影管理
│   └── api/                 # API Routes
│       ├── events/route.ts
│       └── cameras/route.ts
│
├── components/
│   ├── VideoPlayer.tsx      # HLS 播放器
│   ├── CameraGrid.tsx       # 多畫面網格
│   ├── EventCard.tsx        # 事件卡片
│   ├── FenceEditor.tsx      # 圍欄繪製器
│   └── AlertToast.tsx       # 告警通知
│
├── actions/                  # Server Actions
│   ├── events.ts
│   ├── cameras.ts
│   └── fences.ts
│
├── lib/
│   ├── db.ts                # PostgreSQL 連線
│   ├── mqtt.ts              # MQTT 客戶端
│   └── config.ts            # 配置讀取
│
└── hooks/
    ├── useEvents.ts         # 事件 Hook
    └── useMQTT.ts           # MQTT Hook
```

#### 3.6.3 元件設計

```
┌─────────────────────────────────────────────────────────────┐
│                     Component Tree                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  <RootLayout>                                               │
│    ├─ <Header>                                              │
│    │    ├─ <Logo />                                         │
│    │    ├─ <Navigation />                                   │
│    │    └─ <AlertBadge />                                   │
│    │                                                        │
│    ├─ <Main>                                                │
│    │    ├─ <Dashboard>                                      │
│    │    │    ├─ <CameraGrid>                                │
│    │    │    │    └─ <VideoPlayer /> × N                    │
│    │    │    └─ <EventSidebar>                              │
│    │    │         └─ <EventCard /> × M                      │
│    │    │                                                   │
│    │    ├─ <CameraConfig>                                   │
│    │    │    ├─ <CameraForm />                              │
│    │    │    └─ <FenceEditor />                             │
│    │    │                                                   │
│    │    └─ <EventList>                                      │
│    │         ├─ <EventFilter />                             │
│    │         ├─ <EventCard /> × N                           │
│    │         └─ <VideoModal />                              │
│    │                                                        │
│    └─ <AlertToast />                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

<div style="page-break-before: always;"></div>

## 4. 資料設計

### 4.1 資料庫設計

#### 4.1.1 ER Diagram

```
┌─────────────────┐         ┌─────────────────┐
│    cameras      │         │    models       │
├─────────────────┤         ├─────────────────┤
│ id (PK)        │◄───┐    │ id (PK)        │
│ name           │    │    │ name           │
│ location       │    │    │ weights        │
│ model_id (FK)  │────┼───►│ class_file     │
│ enabled        │    │    └─────────────────┘
└────────┬────────┘    │
         │ 1:N         │
         ▼             │
┌─────────────────┐    │
│  virtual_fences │    │
├─────────────────┤    │
│ id (PK)        │    │
│ camera_id (FK) │────┘
│ name           │
│ points (JSONB) │
│ detect_objects │
└─────────────────┘

┌─────────────────┐
│     events      │
├─────────────────┤
│ id (PK)        │
│ camera_id      │
│ class_name     │
│ ts             │
│ score          │
│ fence_id       │
│ video_path     │
│ created_at     │
└─────────────────┘
```

#### 4.1.2 索引設計

```sql
-- events 表索引
CREATE INDEX idx_events_camera_ts ON events(camera_id, ts DESC);
CREATE INDEX idx_events_class ON events(class_name);
CREATE INDEX idx_events_ts ON events(ts DESC);
CREATE INDEX idx_events_fence ON events(fence_id);

-- 使用說明：
-- 1. camera_id + ts: 攝影機事件時間查詢
-- 2. class_name: 依物件類別篩選
-- 3. ts: 全域時間排序
-- 4. fence_id: 依圍欄篩選
```

### 4.2 配置檔設計

#### 4.2.1 cameras.json Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "cameras": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "enabled"],
        "properties": {
          "id": {"type": "string", "pattern": "^[a-z0-9_-]+$"},
          "name": {"type": "string", "maxLength": 100},
          "enabled": {"type": "boolean"},
          "stream": {
            "type": "object",
            "properties": {
              "resolution": {"enum": ["640x480", "1280x720", "1920x1080"]},
              "fps": {"type": "integer", "minimum": 1, "maximum": 60}
            }
          },
          "ai": {
            "type": "object",
            "properties": {
              "modelId": {"type": "string"},
              "confidence": {"type": "number", "minimum": 0, "maximum": 1}
            }
          },
          "virtualFences": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "name", "points", "detectObjects"],
              "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "enabled": {"type": "boolean", "default": true},
                "points": {
                  "type": "array",
                  "minItems": 3,
                  "maxItems": 10,
                  "items": {
                    "type": "object",
                    "properties": {
                      "x": {"type": "number", "minimum": 0, "maximum": 1},
                      "y": {"type": "number", "minimum": 0, "maximum": 1}
                    }
                  }
                },
                "detectObjects": {
                  "type": "array",
                  "items": {"type": "string"}
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

<div style="page-break-before: always;"></div>

## 5. 介面設計

### 5.1 MQTT 介面

#### 5.1.1 Topic 架構

```
vision/
├── {cameraId}/
│   ├── detections     # 偵測結果 (高頻, QoS 0)
│   ├── events         # 入侵事件 (事件驅動, QoS 1)
│   └── status         # 攝影機狀態 (定期, QoS 0)
│
├── system/
│   ├── health         # 系統健康 (定期)
│   └── config         # 配置變更 (事件驅動)
│
└── command/
    ├── reload         # 重載配置
    └── restart        # 重啟服務
```

#### 5.1.2 訊息格式

**偵測結果** (`vision/{cam}/detections`):
```typescript
interface DetectionMessage {
  cameraId: string;
  timestamp: string;  // ISO8601
  frameId: number;
  inferenceTime: number;  // ms
  detections: Array<{
    id: number;
    class_id: number;
    class_name: string;
    bbox: [number, number, number, number];  // [x1, y1, x2, y2] normalized
    score: number;  // 0-1
    center: [number, number];  // [x, y] normalized
  }>;
}
```

**入侵事件** (`vision/{cam}/events`):
```typescript
interface EventMessage {
  id: string;           // evt_{timestamp}_{random}
  camera_id: string;
  class_name: string;
  ts: string;           // ISO8601
  score: number;
  fence_id: string;
  fence_name: string;
  alert_level: 'low' | 'medium' | 'high';
}
```

### 5.2 REST API 介面

#### 5.2.1 事件 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/events | 查詢事件列表 |
| GET | /api/events/:id | 取得單一事件 |
| DELETE | /api/events/:id | 刪除事件 |

**GET /api/events**

Request:
```
GET /api/events?camera=cam1&class=person&from=2025-01-01&to=2025-01-15&page=1&limit=20
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_xxx",
      "camera_id": "cam1",
      "class_name": "person",
      "ts": "2025-01-15T14:32:15.000Z",
      "score": 0.95,
      "video_path": "/events/evt_xxx.mkv"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

#### 5.2.2 攝影機 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/cameras | 取得攝影機列表 |
| GET | /api/cameras/:id | 取得單一攝影機 |
| POST | /api/cameras | 新增攝影機 |
| PUT | /api/cameras/:id | 更新攝影機 |
| DELETE | /api/cameras/:id | 刪除攝影機 |

### 5.3 go2rtc API

| 端點 | 方法 | 說明 |
|------|------|------|
| /api/streams | GET | 列出所有串流 |
| /api/stream?src={id} | GET | 取得串流資訊 |
| /api/stream.m3u8?src={id} | GET | HLS 播放清單 |
| /api/ws?src={id} | WS | WebSocket 串流 |

---

<div style="page-break-before: always;"></div>

## 6. 部署設計

### 6.1 Docker Compose 架構

```yaml
version: '3.8'

services:
  # 串流服務
  raw_restreamer:
    build: ./app
    devices:
      - /dev/video0:/dev/video0
    depends_on:
      - go2rtc

  go2rtc:
    image: alexxit/go2rtc
    ports:
      - "8554:8554"  # RTSP
      - "1984:1984"  # HTTP
    volumes:
      - ./go2rtc/go2rtc.yaml:/config/go2rtc.yaml

  action_recognition_server:
    build: ./app
    depends_on:
      - go2rtc
      - mqtt

  # 處理服務
  model_launcher:
    build: ./models_classify
    volumes:
      - ./share:/share
    depends_on:
      - mqtt

  fence:
    build: ./fence
    depends_on:
      - mqtt
      - postgres

  record:
    build: ./record
    volumes:
      - ./share:/share
    depends_on:
      - mqtt
      - go2rtc

  # 基礎服務
  mqtt:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
    volumes:
      - ./MQTT/mosquitto.conf:/mosquitto/config/mosquitto.conf

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: aihub
      POSTGRES_USER: aihub
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d

  # Web UI
  html16:
    build: ./html16
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - mqtt
      - go2rtc

volumes:
  postgres_data:

networks:
  default:
    name: aihub_net
```

### 6.2 服務啟動順序

```
1. postgres   ─┬─► 2. mqtt ─┬─► 4. model_launcher
               │            ├─► 5. fence
               │            ├─► 6. record
               │            │
3. go2rtc ─────┼────────────┼─► 7. raw_restreamer
               │            │     8. action_recognition
               │            │
               └────────────┴─► 9. html16
```

### 6.3 健康檢查

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

<div style="page-break-before: always;"></div>

## 7. 安全設計

### 7.1 認證機制

| 服務 | 認證方式 |
|------|---------|
| RTSP (go2rtc) | HTTP Basic Auth |
| MQTT | Username/Password |
| PostgreSQL | Username/Password |
| Web UI | Session Cookie (未來) |

### 7.2 網路隔離

```
                    ┌─────────────────────┐
                    │      Internet       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │      Firewall       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
      ┌───────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
      │  Port 3000    │ │  Port 1984  │ │  Port 8554  │
      │  (Web UI)     │ │  (go2rtc)   │ │  (RTSP)     │
      │   公開        │ │   選用      │ │   選用      │
      └───────────────┘ └─────────────┘ └─────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
      ┌───────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
      │  PostgreSQL   │ │    MQTT     │ │  Services   │
      │  Port 5432    │ │  Port 1883  │ │  Internal   │
      │   內部        │ │   內部      │ │   內部      │
      └───────────────┘ └─────────────┘ └─────────────┘
```

### 7.3 敏感資料處理

| 資料 | 處理方式 |
|------|---------|
| 資料庫密碼 | 環境變數 (不入版控) |
| MQTT 密碼 | 環境變數 |
| API 金鑰 | 環境變數 |
| 配置檔案 | .env.example 提供範本 |

---

## 8. 附錄

### 8.1 設計決策記錄

| 決策 | 選擇 | 理由 |
|------|------|------|
| 架構 | 微服務 | 獨立擴展、故障隔離 |
| 訊息佇列 | MQTT | 輕量、IoT 友善、支援 QoS |
| 資料庫 | PostgreSQL | 成熟穩定、JSONB 支援 |
| 串流伺服器 | go2rtc | 多協議支援、低資源 |
| AI 框架 | YOLOv8 | 精度與速度平衡 |
| Web 框架 | Next.js | SSR、Server Actions |
| 容器化 | Docker Compose | 一鍵部署、環境標準化 |

### 8.2 效能設計考量

| 考量 | 設計 |
|------|------|
| 串流延遲 | Zerolatency preset、GOP 優化 |
| 推論速度 | 批次處理、模型輕量化 |
| 記憶體 | 循環緩衝、定期清理 |
| CPU | 硬體加速 VAAPI |
| I/O | 分段錄影、非同步寫入 |

### 8.3 修訂紀錄

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0 | 2025-12-29 | 初版建立 |

---

**文件版本**: v1.0  
**最後更新**: 2025-12-29
