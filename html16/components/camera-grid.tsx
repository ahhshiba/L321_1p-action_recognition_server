"use client"

import { CameraFeed } from "@/components/camera-feed"
import { EventsList } from "@/components/events-list"
import { useCameraConfig } from "@/lib/use-camera-config"

const mockDetections: Record<string, number> = {
  cam1: 3,
  cam2: 1,
  cam3: 0,
  cam4: 2,
}

export function CameraGrid() {
  const { cameras: configCameras } = useCameraConfig()

  const cameras = configCameras.map((cam) => ({
    ...cam,
    detections: mockDetections[cam.id] || 0,
  }))

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <CameraFeed key={camera.id} camera={camera} />
          ))}
        </div>
      </div>

      <div className="w-80 hidden xl:block">
        <EventsList />
      </div>
    </div>
  )
}
