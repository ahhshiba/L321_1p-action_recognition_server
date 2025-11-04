import { type NextRequest, NextResponse } from "next/server"

const GO2RTC_API_URL = process.env.GO2RTC_API_URL || "http://localhost:1984"

// WHEP endpoint proxy to go2rtc
export async function POST(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await context.params
    const body = await request.text()

    console.log("[v0] WHEP request for stream:", name)
    const whepUrl = `${GO2RTC_API_URL}/api/whep?src=${encodeURIComponent(name)}`
    console.log("[v0] Forwarding to go2rtc:", whepUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let response: Response
    try {
      response = await fetch(whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body,
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          console.error("[v0] go2rtc connection timeout")
          return NextResponse.json(
            {
              error: `Connection timeout: go2rtc server at ${GO2RTC_API_URL} did not respond within 10 seconds. Please verify go2rtc is running.`,
            },
            { status: 504 },
          )
        }
        console.error("[v0] Failed to connect to go2rtc:", fetchError.message)
        return NextResponse.json(
          {
            error: `Cannot connect to go2rtc at ${GO2RTC_API_URL}. Please verify: 1) go2rtc is running, 2) GO2RTC_API_URL is correct in .env.local, 3) Stream "${name}" exists in go2rtc. Error: ${fetchError.message}`,
          },
          { status: 502 },
        )
      }
      throw fetchError
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] go2rtc WHEP error:", response.status, errorText)
      if (response.status === 404) {
        return NextResponse.json(
          {
            error: `Stream "${name}" not found in go2rtc. Please add the camera first or verify the stream name is correct.`,
          },
          { status: 404 },
        )
      }
      return NextResponse.json(
        {
          error: `go2rtc error (${response.status}): ${errorText || "Unknown error"}`,
        },
        { status: response.status },
      )
    }

    const sdp = await response.text()
    console.log("[v0] WHEP connection successful for stream:", name)

    return new NextResponse(sdp, {
      status: 201,
      headers: {
        "Content-Type": "application/sdp",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("[v0] WHEP proxy error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "WHEP proxy error",
      },
      { status: 500 },
    )
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
