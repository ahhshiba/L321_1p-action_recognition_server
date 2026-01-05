import { NextResponse } from "next/server"

const EVENTS_DIR = process.env.EVENTS_DIR || "/app/share/events"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get("file")

    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 })
    }

    // Prevent directory traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
    }

    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const filePath = path.join(EVENTS_DIR, filename)

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        console.log("[v0] File not found:", filePath)
        return NextResponse.json({ error: "File not found" }, { status: 404 })
      }

      const fileBuffer = await fs.readFile(filePath)

      // Determine content type based on extension
      const ext = path.extname(filename).toLowerCase()
      const contentTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
      }

      const contentType = contentTypeMap[ext] || "application/octet-stream"

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
        },
      })
    } catch (fsError) {
      console.log("[v0] File system not available:", fsError)
      return NextResponse.json({ error: "File system not available" }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] Error serving media:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
