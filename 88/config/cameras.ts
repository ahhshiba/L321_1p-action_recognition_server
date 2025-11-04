export interface VirtualFence {
  name: string
  points: { x: number; y: number }[] // Polygon coordinates (normalized 0-1 or pixel coordinates)
  enabled: boolean
  detectObjects: string[] // Objects to detect in this fence zone
}

export interface CameraConfig {
  id: string
  name: string
  location: string
  rtspUrl?: string // Added RTSP URL field for camera source
  streamUrl: string // Camera stream name for go2rtc (e.g., "cam1_overlay")
  enabled: boolean
  resolution: string
  fps: number
  detectObjects: string[]
  recordingEnabled: boolean
  snapshotsEnabled: boolean
  motionDetection: boolean
  minConfidence: number // 0-100
  virtualFences?: VirtualFence[]
}

export interface SystemConfig {
  webrtcServerUrl?: string // Added WebRTC server base URL configuration
  availableDetectionObjects?: string[] // Added available detection objects list
  cameras: CameraConfig[]
  storage: {
    retentionDays: number
    maxStorageGB: number
    snapshotRetentionDays: number
  }
  notifications: {
    enabled: boolean
    email?: string
    webhook?: string
    detectionAlerts: string[]
  }
  detection: {
    enabled: boolean
    fps: number
    modelType: "cpu" | "gpu" | "tpu"
  }
}

// Default camera configuration
export const cameraConfig: SystemConfig = {
  webrtcServerUrl: "http://localhost:1984",
  availableDetectionObjects: [
    "person",
    "car",
    "dog",
    "cat",
    "bicycle",
    "motorcycle",
    "bird",
    "package",
    "animal",
    "truck",
    "bus",
  ],
  cameras: [
    {
      id: "cam1",
      name: "Front Door",
      location: "Entrance",
      rtspUrl: "rtsp://example.com/cam1",
      streamUrl: "cam1_overlay", // Use camera name directly for progressive MP4
      enabled: true,
      resolution: "1920x1080",
      fps: 30,
      detectObjects: ["person", "car", "package"],
      recordingEnabled: true,
      snapshotsEnabled: true,
      motionDetection: true,
      minConfidence: 70,
      virtualFences: [
        {
          name: "Entry Zone",
          points: [
            { x: 0.2, y: 0.3 },
            { x: 0.8, y: 0.3 },
            { x: 0.8, y: 0.9 },
            { x: 0.2, y: 0.9 },
          ],
          enabled: true,
          detectObjects: ["person", "car"],
        },
      ],
    },
    {
      id: "cam2",
      name: "Backyard",
      location: "Garden",
      rtspUrl: "rtsp://example.com/cam2",
      streamUrl: "cam2_overlay", // Use camera name directly for progressive MP4
      enabled: true,
      resolution: "1920x1080",
      fps: 30,
      detectObjects: ["person", "dog", "cat", "animal"],
      recordingEnabled: true,
      snapshotsEnabled: true,
      motionDetection: true,
      minConfidence: 65,
      virtualFences: [
        {
          name: "Perimeter",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.9, y: 0.8 },
            { x: 0.1, y: 0.8 },
          ],
          enabled: true,
          detectObjects: ["person", "animal"],
        },
      ],
    },
    {
      id: "cam3",
      name: "Garage",
      location: "Parking",
      rtspUrl: "rtsp://example.com/cam3",
      streamUrl: "cam3_overlay", // Use camera name directly for progressive MP4
      enabled: true,
      resolution: "1920x1080",
      fps: 25,
      detectObjects: ["person", "car", "bicycle"],
      recordingEnabled: true,
      snapshotsEnabled: false,
      motionDetection: true,
      minConfidence: 75,
      virtualFences: [
        {
          name: "Garage Door",
          points: [
            { x: 0.3, y: 0.4 },
            { x: 0.7, y: 0.4 },
            { x: 0.7, y: 0.9 },
            { x: 0.3, y: 0.9 },
          ],
          enabled: true,
          detectObjects: ["car", "bicycle"],
        },
      ],
    },
    {
      id: "cam4",
      name: "Side Entrance",
      location: "Side Door",
      rtspUrl: "rtsp://example.com/cam4",
      streamUrl: "cam4_overlay", // Use camera name directly for progressive MP4
      enabled: true,
      resolution: "1280x720",
      fps: 20,
      detectObjects: ["person", "package"],
      recordingEnabled: true,
      snapshotsEnabled: true,
      motionDetection: true,
      minConfidence: 70,
    },
  ],
  storage: {
    retentionDays: 7,
    maxStorageGB: 500,
    snapshotRetentionDays: 30,
  },
  notifications: {
    enabled: true,
    detectionAlerts: ["person", "package"],
  },
  detection: {
    enabled: true,
    fps: 5,
    modelType: "cpu",
  },
}

// Helper functions
export function getCameraById(id: string): CameraConfig | undefined {
  return cameraConfig.cameras.find((cam) => cam.id === id)
}

export function getEnabledCameras(): CameraConfig[] {
  return cameraConfig.cameras.filter((cam) => cam.enabled)
}

export function getCamerasByDetectionObject(object: string): CameraConfig[] {
  return cameraConfig.cameras.filter((cam) => cam.detectObjects.includes(object))
}
