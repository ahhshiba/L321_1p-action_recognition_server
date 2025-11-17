import { NextResponse } from "next/server"

const EVENTS_JSON = process.env.EVENTS_JSON || "/app/share/events.json"

export async function GET() {
  try {
    console.log("[v0] Loading events from:", EVENTS_JSON)

    // Try to use Node.js fs if available
    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const filePath = path.isAbsolute(EVENTS_JSON) ? EVENTS_JSON : path.join(process.cwd(), EVENTS_JSON)

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        // File doesn't exist, create it with default structure
        console.log("[v0] Events file doesn't exist, creating:", filePath)
        const defaultData = { events: [] }
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), "utf-8")
        return NextResponse.json(defaultData)
      }

      const fileContent = await fs.readFile(filePath, "utf-8")

      // Handle empty file
      if (!fileContent.trim()) {
        console.log("[v0] Events file is empty, initializing")
        const defaultData = { events: [] }
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), "utf-8")
        return NextResponse.json(defaultData)
      }

      const data = JSON.parse(fileContent)
      console.log("[v0] ✓ Successfully loaded events from", EVENTS_JSON)
      return NextResponse.json(data)
    } catch (fsError) {
      console.log("[v0] File system not available, returning empty events:", fsError)
      return NextResponse.json({ events: [] })
    }
  } catch (error) {
    console.error("[v0] ✗ Error loading events:", error)
    return NextResponse.json({ events: [] }, { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] Saving events to:", EVENTS_JSON)

    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const filePath = path.isAbsolute(EVENTS_JSON) ? EVENTS_JSON : path.join(process.cwd(), EVENTS_JSON)

      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf-8")

      console.log("[v0] ✓ Successfully saved events to", EVENTS_JSON)
      return NextResponse.json({ success: true })
    } catch (fsError) {
      console.log("[v0] File system not available:", fsError)
      return NextResponse.json({ success: false, error: "File system not available" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] ✗ Error saving events:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("id")

    if (!eventId) {
      return NextResponse.json({ success: false, error: "Event ID required" }, { status: 400 })
    }

    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const filePath = path.isAbsolute(EVENTS_JSON) ? EVENTS_JSON : path.join(process.cwd(), EVENTS_JSON)
      const fileContent = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(fileContent)

      data.events = data.events.filter((event: { id: string }) => event.id !== eventId)

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")

      console.log("[v0] ✓ Successfully deleted event:", eventId)
      return NextResponse.json({ success: true })
    } catch (fsError) {
      console.log("[v0] File system not available:", fsError)
      return NextResponse.json({ success: false, error: "File system not available" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] ✗ Error deleting event:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
