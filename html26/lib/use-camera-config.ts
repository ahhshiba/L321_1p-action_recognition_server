"use client"

import { useState, useEffect } from "react"
import { cameraConfig, type CameraConfig } from "@/config/cameras"

const STORAGE_KEY = "frigate_camera_config"

export function useCameraConfig() {
  const [cameras, setCameras] = useState<CameraConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadConfig() {
      try {
        // Dynamic import to avoid breaking in browser environment
        const { loadCameraConfig } = await import("@/app/actions/camera-config")
        const result = await loadCameraConfig()

        if (result.success && result.cameras) {
          console.log("[v0] Loaded cameras from JSON file")
          setCameras(result.cameras)
          setIsLoading(false)
          return
        }
      } catch (error) {
        console.log("[v0] Server Action not available, using localStorage")
      }

      // Fallback to localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          console.log("[v0] Loaded cameras from localStorage")
          setCameras(parsed)
        } else {
          // Use default config
          console.log("[v0] Using default camera config")
          setCameras(cameraConfig.cameras)
        }
      } catch (error) {
        console.error("[v0] Failed to load from localStorage:", error)
        setCameras(cameraConfig.cameras)
      }

      setIsLoading(false)
    }

    loadConfig()
  }, [])

  const updateCameras = async (newCameras: CameraConfig[]) => {
    setCameras(newCameras)

    try {
      const { saveCameraConfig } = await import("@/app/actions/camera-config")
      const result = await saveCameraConfig(newCameras)

      if (result.success) {
        console.log("[v0] Saved cameras to JSON file")
        return
      }
    } catch (error) {
      console.log("[v0] Server Action not available, using localStorage")
    }

    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCameras))
      console.log("[v0] Saved cameras to localStorage")
    } catch (error) {
      console.error("[v0] Failed to save to localStorage:", error)
    }
  }

  return { cameras, updateCameras, isLoading }
}
