"use server"

import { promises as fs } from "fs"
import path from "path"

const RECORDINGS_FILE = path.join(process.cwd(), "public", "data", "recordings.json")

export async function getRecordings() {
  try {
    const fileContent = await fs.readFile(RECORDINGS_FILE, "utf-8")
    const data = JSON.parse(fileContent)
    return { success: true, recordings: data.recordings }
  } catch (error) {
    console.error("Error reading recordings:", error)
    return { success: false, recordings: [] }
  }
}

export async function deleteRecording(recordingId: string) {
  try {
    const fileContent = await fs.readFile(RECORDINGS_FILE, "utf-8")
    const data = JSON.parse(fileContent)

    data.recordings = data.recordings.filter((rec: { id: string }) => rec.id !== recordingId)

    await fs.writeFile(RECORDINGS_FILE, JSON.stringify(data, null, 2), "utf-8")
    return { success: true }
  } catch (error) {
    console.error("Error deleting recording:", error)
    return { success: false, error: "Failed to delete recording" }
  }
}
