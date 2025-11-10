import { NextResponse } from "next/server"

const RECORDINGS_JSON = process.env.RECORDINGS_JSON || "/app/share/recordings.json"

export async function GET() {
  try {
    console.log("[v0] Loading recordings from:", RECORDINGS_JSON)

    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const filePath = path.isAbsolute(RECORDINGS_JSON) ? RECORDINGS_JSON : path.join(process.cwd(), RECORDINGS_JSON)

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        // File doesn't exist, create it
        console.log("[v0] Recordings file doesn't exist, creating:", filePath)
        const defaultData = { recordings: [] }
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), "utf-8")
        return NextResponse.json(defaultData)
      }

      const fileContent = await fs.readFile(filePath, "utf-8")

      // Handle empty file
      if (!fileContent.trim()) {
        console.log("[v0] Recordings file is empty, initializing")
        const defaultData = { recordings: [] }
        await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), "utf-8")
        return NextResponse.json(defaultData)
      }

      const data = JSON.parse(fileContent)
      console.log("[v0] ✓ Successfully loaded recordings from", RECORDINGS_JSON)
      return NextResponse.json(data)
    } catch (fsError) {
      console.log("[v0] File system not available, returning empty recordings:", fsError)
      return NextResponse.json({ recordings: [] })
    }
  } catch (error) {
    console.error("[v0] ✗ Error loading recordings:", error)
    return NextResponse.json({ recordings: [] }, { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] Saving recordings to:", RECORDINGS_JSON)

    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const filePath = path.isAbsolute(RECORDINGS_JSON) ? RECORDINGS_JSON : path.join(process.cwd(), RECORDINGS_JSON)

      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf-8")

      console.log("[v0] ✓ Successfully saved recordings to", RECORDINGS_JSON)
      return NextResponse.json({ success: true })
    } catch (fsError) {
      console.log("[v0] File system not available:", fsError)
      return NextResponse.json({ success: false, error: "File system not available" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] ✗ Error saving recordings:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recordingId = searchParams.get("id")

    if (!recordingId) {
      return NextResponse.json({ success: false, error: "Recording ID required" }, { status: 400 })
    }

    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const filePath = path.isAbsolute(RECORDINGS_JSON) ? RECORDINGS_JSON : path.join(process.cwd(), RECORDINGS_JSON)
      const fileContent = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(fileContent)

      data.recordings = data.recordings.filter((rec: { id: string }) => rec.id !== recordingId)

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")

      console.log("[v0] ✓ Successfully deleted recording:", recordingId)
      return NextResponse.json({ success: true })
    } catch (fsError) {
      console.log("[v0] File system not available:", fsError)
      return NextResponse.json({ success: false, error: "File system not available" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] ✗ Error deleting recording:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
