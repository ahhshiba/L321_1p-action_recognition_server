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
  streamUrl: string // WebRTC WHEP endpoint
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
  cameras: [
    {
      id: "cam1",
      name: "Front Door",
      location: "Entrance",
      streamUrl: "/webrtc/cam1_overlay/whep",
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
          detectObjects: ["person", "car"], // Added detectObjects to specify what each fence should detect
        },
      ],
    },
    {
      id: "cam2",
      name: "Backyard",
      location: "Garden",
      streamUrl: "/webrtc/cam2_overlay/whep",
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
          detectObjects: ["person", "animal"], // Added detectObjects to specify what each fence should detect
        },
      ],
    },
    {
      id: "cam3",
      name: "Garage",
      location: "Parking",
      streamUrl: "/webrtc/cam3_overlay/whep",
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
          detectObjects: ["car", "bicycle"], // Added detectObjects to specify what each fence should detect
        },
      ],
    },
    {
      id: "cam4",
      name: "Side Entrance",
      location: "Side Door",
      streamUrl: "/webrtc/cam4_overlay/whep",
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
