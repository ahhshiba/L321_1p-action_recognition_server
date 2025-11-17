"use server"

import { promises as fs } from "fs"
import path from "path"
import type { CameraConfig } from "@/config/cameras"

const CONFIG_FILE_PATH = path.join(process.cwd(), "config", "cameras.json")

export async function saveCameraConfig(cameras: CameraConfig[]) {
  try {
    const currentContent = await fs.readFile(CONFIG_FILE_PATH, "utf-8")
    const config = JSON.parse(currentContent)

    config.cameras = cameras

    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf-8")

    console.log("[v0] Successfully saved camera config to cameras.json")
    return { success: true }
  } catch (error) {
    console.error("[v0] Failed to save camera config:", error)
    return { success: false, error: String(error) }
  }
}

export async function loadCameraConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE_PATH, "utf-8")
    const config = JSON.parse(content)

    console.log("[v0] Successfully loaded camera config from cameras.json")
    return {
      success: true,
      cameras: config.cameras,
      availableDetectionObjects: config.availableDetectionObjects || [],
      webrtcServerUrl: config.webrtcServerUrl || "", // Added webrtcServerUrl to return value
    }
  } catch (error) {
    console.error("[v0] Failed to load camera config:", error)
    return { success: false, error: String(error), cameras: [], availableDetectionObjects: [], webrtcServerUrl: "" }
  }
}
