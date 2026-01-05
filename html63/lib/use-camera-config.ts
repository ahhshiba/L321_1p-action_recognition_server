"use client"

import { useState, useEffect } from "react"
import { cameraConfig, type CameraConfig } from "@/config/cameras"

const STORAGE_KEY = "frigate_camera_config"

function extractCameraName(streamUrl: string): string {
  if (!streamUrl) return ""

  // If it's already a simple name (no slashes or protocol), return as-is
  if (!streamUrl.includes("/") && !streamUrl.includes(":")) {
    return streamUrl
  }

  // Extract from RTSP URL: rtsp://127.0.0.1:8556/cam1_overlay -> cam1_overlay
  if (streamUrl.startsWith("rtsp://")) {
    const parts = streamUrl.split("/")
    return parts[parts.length - 1] || ""
  }

  // Extract from old WHEP path: /webrtc/cam3_overlay/whep -> cam3_overlay
  if (streamUrl.includes("/webrtc/") && streamUrl.includes("/whep")) {
    const match = streamUrl.match(/\/webrtc\/([^/]+)\/whep/)
    return match ? match[1] : ""
  }

  // Extract from path: /some/path/camera_name -> camera_name
  const parts = streamUrl.split("/")
  return parts[parts.length - 1] || streamUrl
}

export function useCameraConfig() {
  const [cameras, setCameras] = useState<CameraConfig[]>([])
  const [availableDetectionObjects, setAvailableDetectionObjects] = useState<string[]>([])
  const [webrtcServerUrl, setWebrtcServerUrl] = useState<string>(
    cameraConfig.webrtcServerUrl || "http://localhost:1984",
  )
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadConfig() {
      try {
        console.log("[v0] Attempting to load config from API (file system)")
        const response = await fetch("/api/camera-config")
        const result = await response.json()

        if (result.success) {
          console.log("[v0] Successfully loaded config from cameras.json file")
          setCameras(result.cameras || [])
          setAvailableDetectionObjects(result.availableDetectionObjects || cameraConfig.availableDetectionObjects || [])
          setWebrtcServerUrl(result.webrtcServerUrl || cameraConfig.webrtcServerUrl || "http://localhost:1984")
          setIsLoading(false)
          return
        } else {
          console.warn("[v0] API returned unsuccessful, error:", result.error)
        }
      } catch (error) {
        console.warn("[v0] Failed to load from API:", error)
      }

      loadFromLocalStorage()
    }

    function loadFromLocalStorage() {
      console.log("[v0] Loading from localStorage or defaults")
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          console.log("[v0] Loaded cameras from localStorage")

          let camerasData = parsed.cameras || parsed
          let needsMigration = false

          camerasData = camerasData.map((cam: CameraConfig) => {
            const extractedName = extractCameraName(cam.streamUrl)
            if (extractedName !== cam.streamUrl) {
              console.log(`[v0] Migrating camera ${cam.name} streamUrl from "${cam.streamUrl}" to "${extractedName}"`)
              needsMigration = true
              return { ...cam, streamUrl: extractedName }
            }
            return cam
          })

          setCameras(camerasData)

          if (parsed.availableDetectionObjects) {
            setAvailableDetectionObjects(parsed.availableDetectionObjects)
          } else {
            setAvailableDetectionObjects(cameraConfig.availableDetectionObjects || [])
          }

          let serverUrl = parsed.webrtcServerUrl
          if (!serverUrl || serverUrl === "https://webrtc.example.com" || serverUrl === "http://127.0.0.1:8556") {
            serverUrl = cameraConfig.webrtcServerUrl || "http://localhost:1984"
            console.log("[v0] Migrating webrtcServerUrl to:", serverUrl)
            needsMigration = true
          }
          setWebrtcServerUrl(serverUrl)

          if (needsMigration) {
            const updatedConfig = {
              cameras: camerasData,
              availableDetectionObjects:
                parsed.availableDetectionObjects || cameraConfig.availableDetectionObjects || [],
              webrtcServerUrl: serverUrl,
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig))
            console.log("[v0] Saved migrated config to localStorage")
          }
        } else {
          console.log("[v0] Using default camera config")
          setCameras(cameraConfig.cameras)
          setAvailableDetectionObjects(cameraConfig.availableDetectionObjects || [])
          setWebrtcServerUrl(cameraConfig.webrtcServerUrl || "http://localhost:1984")
        }
      } catch (error) {
        console.error("[v0] Failed to load from localStorage:", error)
        setCameras(cameraConfig.cameras)
        setAvailableDetectionObjects(cameraConfig.availableDetectionObjects || [])
        setWebrtcServerUrl(cameraConfig.webrtcServerUrl || "http://localhost:1984")
      }

      setIsLoading(false)
    }

    loadConfig()
  }, [])

  const updateCameras = async (newCameras: CameraConfig[]) => {
    setCameras(newCameras)

    try {
      console.log("[v0] Attempting to save config to cameras.json via API")
      const response = await fetch("/api/camera-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cameras: newCameras }),
      })
      const result = await response.json()

      if (result.success) {
        console.log("[v0] ✓ Successfully saved cameras to config/cameras.json file")
        // Also save to localStorage as backup
        const configData = {
          cameras: newCameras,
          availableDetectionObjects,
          webrtcServerUrl,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(configData))
        console.log("[v0] ✓ Also saved backup to localStorage")
        return
      } else {
        console.error("[v0] ✗ Failed to save to file:", result.error)
      }
    } catch (error) {
      console.error("[v0] ✗ API error when saving:", error)
    }

    try {
      const configData = {
        cameras: newCameras,
        availableDetectionObjects,
        webrtcServerUrl,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configData))
      console.log("[v0] Saved cameras to localStorage as fallback")
    } catch (error) {
      console.error("[v0] Failed to save to localStorage:", error)
    }
  }

  return { cameras, availableDetectionObjects, webrtcServerUrl, updateCameras, isLoading }
}
