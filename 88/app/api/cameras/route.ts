import { type NextRequest, NextResponse } from "next/server"

const GO2RTC_API_URL = process.env.GO2RTC_API_URL || "http://localhost:1984"

interface Go2rtcStreamConfig {
  producers?: Array<{ url: string }>
  consumers?: unknown
}

// GET /api/cameras - Get all cameras and streams from go2rtc
export async function GET() {
  try {
    // Get streams from go2rtc
    const response = await fetch(`${GO2RTC_API_URL}/api/streams`)

    if (!response.ok) {
      throw new Error(`go2rtc API error: ${response.status}`)
    }

    const streams = await response.json()

    const cameras = (Object.entries(streams) as [string, Go2rtcStreamConfig][]).map(([name, config]) => ({
      id: name,
      name: name,
      streamUrl: name, // For progressive MP4 playback
      rtspUrl: Array.isArray(config.producers) ? config.producers[0].url : "",
      enabled: true,
      zones: [],
    }))

    return NextResponse.json({ success: true, cameras })
  } catch (error) {
    console.error("[v0] Failed to fetch cameras from go2rtc:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch cameras from go2rtc" }, { status: 500 })
  }
}

// POST /api/cameras - Create a new camera/stream in go2rtc
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, rtspUrl } = body

    if (!name || !rtspUrl) {
      return NextResponse.json({ success: false, error: "Name and RTSP URL are required" }, { status: 400 })
    }

    const checkResponse = await fetch(`${GO2RTC_API_URL}/api/streams`)
    if (checkResponse.ok) {
      const existingStreams = await checkResponse.json()
      if (existingStreams[name]) {
        console.log("[v0] Stream already exists in go2rtc:", name)
        // Return success with existing stream info instead of error
        return NextResponse.json({
          success: true,
          camera: {
            id: name,
            name,
            streamUrl: name,
            rtspUrl: existingStreams[name].producers?.[0]?.url || rtspUrl,
            enabled: true,
            zones: [],
          },
          message: "Stream already exists",
        })
      }
    }

    // Register stream with go2rtc using PUT
    const response = await fetch(
      `${GO2RTC_API_URL}/api/streams?name=${encodeURIComponent(name)}&src=${encodeURIComponent(rtspUrl)}`,
      { method: "PUT" },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`go2rtc API error: ${response.status} - ${errorText}`)
    }

    console.log("[v0] Successfully registered stream with go2rtc:", name)

    return NextResponse.json({
      success: true,
      camera: {
        id: name,
        name,
        streamUrl: name,
        rtspUrl,
        enabled: true,
        zones: [],
      },
    })
  } catch (error) {
    console.error("[v0] Failed to create camera in go2rtc:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create camera" },
      { status: 500 },
    )
  }
}
