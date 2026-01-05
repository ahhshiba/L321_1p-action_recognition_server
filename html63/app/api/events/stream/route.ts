import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const file = searchParams.get("file")

  if (!file) {
    return new Response("Missing file parameter", { status: 400 })
  }

  // Get events directory from environment
  const eventsDir = process.env.EVENTS_DIR || "/app/share/events"
  const filePath = `${eventsDir}/${file}`

  try {
    const fs = await import("fs/promises")
    const path = await import("path")

    // Check if file exists
    await fs.access(filePath)

    const stat = await fs.stat(filePath)
    const fileSize = stat.size
    const range = request.headers.get("range")

    if (range) {
      // Handle range requests for seeking
      const parts = range.replace(/bytes=/, "").split("-")
      const start = Number.parseInt(parts[0], 10)
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1
      const chunksize = end - start + 1

      const fileHandle = await fs.open(filePath, "r")
      const buffer = Buffer.alloc(chunksize)
      await fileHandle.read(buffer, 0, chunksize, start)
      await fileHandle.close()

      return new Response(buffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": "video/mp4",
        },
      })
    } else {
      // Stream entire file
      const fileBuffer = await fs.readFile(filePath)

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes",
        },
      })
    }
  } catch (error: any) {
    console.error("[v0] Stream error:", error)
    return new Response(`Error streaming video: ${error.message}`, { status: 500 })
  }
}
