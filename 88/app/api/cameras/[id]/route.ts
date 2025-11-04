import { type NextRequest, NextResponse } from "next/server"

const GO2RTC_API_URL = process.env.GO2RTC_API_URL || "http://localhost:1984"

// PATCH /api/cameras/[id] - Update a camera/stream in go2rtc
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { rtspUrl } = body

    if (!rtspUrl) {
      return NextResponse.json({ success: false, error: "RTSP URL is required" }, { status: 400 })
    }

    // Update stream in go2rtc using PATCH
    const response = await fetch(
      `${GO2RTC_API_URL}/api/streams?name=${encodeURIComponent(id)}&src=${encodeURIComponent(rtspUrl)}`,
      { method: "PATCH" },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`go2rtc API error: ${response.status} - ${errorText}`)
    }

    console.log("[v0] Successfully updated stream in go2rtc:", id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to update camera in go2rtc:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update camera" },
      { status: 500 },
    )
  }
}

// DELETE /api/cameras/[id] - Delete a camera/stream from go2rtc
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Delete stream from go2rtc
    const response = await fetch(`${GO2RTC_API_URL}/api/streams?name=${encodeURIComponent(id)}`, { method: "DELETE" })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`go2rtc API error: ${response.status} - ${errorText}`)
    }

    console.log("[v0] Successfully deleted stream from go2rtc:", id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete camera from go2rtc:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete camera" },
      { status: 500 },
    )
  }
}
