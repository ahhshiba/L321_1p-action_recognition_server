"use server"

import { promises as fs } from "fs"
import path from "path"

const EVENTS_FILE = process.env.EVENTS_JSON || path.join(process.cwd(), "share", "events.json")

export async function getEvents() {
  try {
    const filePath = path.isAbsolute(EVENTS_FILE) ? EVENTS_FILE : path.join(process.cwd(), EVENTS_FILE)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)
    return { success: true, events: data.events }
  } catch (error) {
    console.error("Error reading events:", error)
    return { success: false, events: [] }
  }
}

export async function deleteEvent(eventId: string) {
  try {
    const filePath = path.isAbsolute(EVENTS_FILE) ? EVENTS_FILE : path.join(process.cwd(), EVENTS_FILE)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    data.events = data.events.filter((event: { id: string }) => event.id !== eventId)

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
    return { success: true }
  } catch (error) {
    console.error("Error deleting event:", error)
    return { success: false, error: "Failed to delete event" }
  }
}

export async function addEvent(event: Record<string, unknown>) {
  try {
    const filePath = path.isAbsolute(EVENTS_FILE) ? EVENTS_FILE : path.join(process.cwd(), EVENTS_FILE)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    data.events.unshift(event)

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
    return { success: true }
  } catch (error) {
    console.error("Error adding event:", error)
    return { success: false, error: "Failed to add event" }
  }
}
