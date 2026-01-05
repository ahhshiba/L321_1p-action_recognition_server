import type { NextRequest } from "next/server"
import { ReadableStream } from "stream/web"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const file = searchParams.get("file")

  if (!file) {
    return new Response("Missing file parameter", { status: 400 })
  }

  // Get recordings directory from environment
  const recordingsDir = process.env.RECORDINGS_DIR || "/app/share/recordings"
  const filePath = `${recordingsDir}/${file}`

  try {
    // Check if file exists
    const fs = await import("fs/promises")
    await fs.access(filePath)

    const fileExt = file.toLowerCase().split(".").pop()

    if (fileExt === "mp4") {
      const fileHandle = await fs.open(filePath, "r")
      const stream = fileHandle.createReadStream()

      return new Response(stream as any, {
        headers: {
          "Content-Type": "video/mp4",
          "Cache-Control": "no-cache",
          "Accept-Ranges": "bytes",
        },
      })
    } else if (fileExt === "ts") {
      const fileHandle = await fs.open(filePath, "r")
      const stream = fileHandle.createReadStream()

      return new Response(stream as any, {
        headers: {
          "Content-Type": "video/mp2t", // MPEG-TS MIME type
          "Cache-Control": "no-cache",
          "Accept-Ranges": "bytes",
        },
      })
    }

    const { spawn } = await import("child_process")

    // FFmpeg command to transcode mkv to mp4 on-the-fly
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      filePath,
      "-c:v",
      "libx264", // H.264 video codec
      "-preset",
      "ultrafast", // Fast encoding
      "-crf",
      "23", // Quality
      "-c:a",
      "aac", // AAC audio codec
      "-b:a",
      "128k", // Audio bitrate
      "-movflags",
      "frag_keyframe+empty_moov", // Enable streaming
      "-f",
      "mp4", // Output format
      "pipe:1", // Output to stdout
    ])

    // Create a readable stream from FFmpeg output
    const stream = new ReadableStream({
      start(controller) {
        ffmpeg.stdout.on("data", (chunk) => {
          controller.enqueue(chunk)
        })

        ffmpeg.stdout.on("end", () => {
          controller.close()
        })

        ffmpeg.stderr.on("data", (data) => {
          console.error(`[v0] FFmpeg stderr: ${data}`)
        })

        ffmpeg.on("error", (error) => {
          console.error("[v0] FFmpeg error:", error)
          controller.error(error)
        })

        ffmpeg.on("close", (code) => {
          if (code !== 0) {
            console.error(`[v0] FFmpeg exited with code ${code}`)
          }
        })
      },
      cancel() {
        ffmpeg.kill()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error: any) {
    console.error("[v0] Stream error:", error)
    return new Response(`Error streaming video: ${error.message}`, { status: 500 })
  }
}
