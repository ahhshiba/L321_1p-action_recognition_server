import { NextResponse } from "next/server"
import { writeFile, readFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const CONFIG_PATH = process.env.CAMERAS_JSON || join(process.cwd(), "share", "cameras.json")

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  console.log("[v0] POST /api/camera-config - Starting save operation")
  console.log("[v0] Working directory:", process.cwd())
  console.log("[v0] Config path:", CONFIG_PATH)

  try {
    const { cameras } = await request.json()
    console.log("[v0] Received camera data:", JSON.stringify(cameras, null, 2))

    const shareDir = join(process.cwd(), "share")
    console.log("[v0] Share directory path:", shareDir)
    console.log("[v0] Share directory exists:", existsSync(shareDir))

    if (!existsSync(shareDir)) {
      console.log("[v0] Creating share directory...")
      await mkdir(shareDir, { recursive: true })
      console.log("[v0] Share directory created")
    }

    // Read current config
    let config: any = {
      cameras: [],
      availableDetectionObjects: [],
      webrtcServerUrl: "http://localhost:1984",
    }

    if (existsSync(CONFIG_PATH)) {
      console.log("[v0] Reading existing config file...")
      const currentContent = await readFile(CONFIG_PATH, "utf-8")
      if (currentContent.trim().length > 0) {
        config = JSON.parse(currentContent)
        console.log("[v0] Current config loaded")
      } else {
        console.log("[v0] Config file is empty, using defaults")
      }
    } else {
      console.log("[v0] No existing config file found, using defaults")
    }

    // Update cameras
    config.cameras = cameras

    // Write back to file
    console.log("[v0] Writing to file:", CONFIG_PATH)
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8")
    console.log("[v0] ✓ Successfully saved camera config to", CONFIG_PATH)

    // Verify file was written
    if (existsSync(CONFIG_PATH)) {
      const verifyContent = await readFile(CONFIG_PATH, "utf-8")
      console.log("[v0] Verified file size:", verifyContent.length, "bytes")
      console.log("[v0] First 200 chars:", verifyContent.substring(0, 200))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] ✗ Failed to save camera config:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : String(error))
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  console.log("[v0] GET /api/camera-config - Starting load operation")
  console.log("[v0] Working directory:", process.cwd())
  console.log("[v0] Config path:", CONFIG_PATH)
  console.log("[v0] File exists:", existsSync(CONFIG_PATH))

  try {
    const defaultConfig = {
      cameras: [],
      availableDetectionObjects: [],
      webrtcServerUrl: "http://localhost:1984",
    }

    // Check if file exists
    if (!existsSync(CONFIG_PATH)) {
      console.log("[v0] Config file does not exist, creating default...")

      // Try to create the file
      try {
        const shareDir = join(process.cwd(), "share")
        if (!existsSync(shareDir)) {
          await mkdir(shareDir, { recursive: true })
          console.log("[v0] Created share directory")
        }
        await writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), "utf-8")
        console.log("[v0] ✓ Created new cameras.json at", CONFIG_PATH)
      } catch (createError) {
        console.error("[v0] ✗ Could not create config file:", createError)
      }

      return NextResponse.json({
        success: true,
        ...defaultConfig,
      })
    }

    console.log("[v0] Reading config file...")
    const content = await readFile(CONFIG_PATH, "utf-8")
    console.log("[v0] File content length:", content.length)

    if (content.trim().length === 0) {
      console.log("[v0] File is empty, initializing with default config...")
      await writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), "utf-8")
      console.log("[v0] ✓ Initialized empty cameras.json with default config")
      return NextResponse.json({
        success: true,
        ...defaultConfig,
      })
    }

    const config = JSON.parse(content)
    console.log("[v0] Config parsed successfully, cameras count:", config.cameras?.length || 0)

    console.log("[v0] ✓ Successfully loaded camera config from", CONFIG_PATH)
    return NextResponse.json({
      success: true,
      cameras: config.cameras || [],
      availableDetectionObjects: config.availableDetectionObjects || [],
      webrtcServerUrl: config.webrtcServerUrl || "http://localhost:1984",
    })
  } catch (error) {
    console.error("[v0] ✗ Failed to load camera config:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : String(error))
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        cameras: [],
        availableDetectionObjects: [],
        webrtcServerUrl: "http://localhost:1984",
      },
      { status: 500 },
    )
  }
}
