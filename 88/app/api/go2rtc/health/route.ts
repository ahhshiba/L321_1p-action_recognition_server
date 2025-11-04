import { NextResponse } from "next/server"

const GO2RTC_API_URL = process.env.GO2RTC_API_URL || "http://localhost:1984"

// Health check endpoint to verify go2rtc connectivity
export async function GET() {
  try {
    console.log("[v0] Checking go2rtc health at:", GO2RTC_API_URL)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${GO2RTC_API_URL}/api/streams`, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: `go2rtc returned status ${response.status}`,
          url: GO2RTC_API_URL,
        },
        { status: 502 },
      )
    }

    const streams = await response.json()

    return NextResponse.json({
      status: "ok",
      message: "go2rtc is reachable",
      url: GO2RTC_API_URL,
      streamCount: Object.keys(streams).length,
      streams: Object.keys(streams),
    })
  } catch (error) {
    console.error("[v0] go2rtc health check failed:", error)
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Cannot connect to go2rtc",
        url: GO2RTC_API_URL,
        suggestion: "Please verify: 1) go2rtc is running, 2) GO2RTC_API_URL environment variable is correct",
      },
      { status: 502 },
    )
  }
}
