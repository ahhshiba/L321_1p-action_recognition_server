"use server"

import { promises as fs } from "fs"
import path from "path"

const RECORDINGS_FILE = process.env.RECORDINGS_JSON || path.join(process.cwd(), "share", "recordings.json")

export async function getRecordings() {
  try {
    const filePath = path.isAbsolute(RECORDINGS_FILE) ? RECORDINGS_FILE : path.join(process.cwd(), RECORDINGS_FILE)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)
    return { success: true, recordings: data.recordings }
  } catch (error) {
    console.error("Error reading recordings:", error)
    return { success: false, recordings: [] }
  }
}

export async function deleteRecording(recordingId: string) {
  try {
    const filePath = path.isAbsolute(RECORDINGS_FILE) ? RECORDINGS_FILE : path.join(process.cwd(), RECORDINGS_FILE)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    data.recordings = data.recordings.filter((rec: { id: string }) => rec.id !== recordingId)

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
    return { success: true }
  } catch (error) {
    console.error("Error deleting recording:", error)
    return { success: false, error: "Failed to delete recording" }
  }
}
