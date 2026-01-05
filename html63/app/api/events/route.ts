export const runtime = "nodejs"

import { NextResponse } from "next/server"
import postgres from "postgres"

function createSql() {
  const dbHost = process.env.DATABASE_HOST
  const dbPort = process.env.DATABASE_PORT
  const dbName = process.env.DATABASE_NAME
  const dbUser = process.env.DATABASE_USER
  const dbPass = process.env.DATABASE_PASSWORD

  if (!dbHost || !dbPort || !dbName || !dbUser || !dbPass) {
    return null
  }

  return postgres({
    host: dbHost,
    port: Number.parseInt(dbPort),
    database: dbName,
    username: dbUser,
    password: dbPass,
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
  })
}

export async function GET(request: Request) {
  let sql: ReturnType<typeof postgres> | null = null

  try {
    console.log("[v0] Fetching events from database")

    const dbHost = process.env.DATABASE_HOST
    const dbPort = process.env.DATABASE_PORT
    const dbName = process.env.DATABASE_NAME
    const dbUser = process.env.DATABASE_USER
    const dbPass = process.env.DATABASE_PASSWORD

    console.log("[v0] Environment variables:")
    console.log("[v0] - DATABASE_HOST:", dbHost || "NOT SET")
    console.log("[v0] - DATABASE_PORT:", dbPort || "NOT SET")
    console.log("[v0] - DATABASE_NAME:", dbName || "NOT SET")
    console.log("[v0] - DATABASE_USER:", dbUser || "NOT SET")
    console.log("[v0] - DATABASE_PASSWORD:", dbPass ? "SET" : "NOT SET")

    sql = createSql()

    if (!sql) {
      console.log("[v0] ✗ Database connection could not be created - missing environment variables")
      return NextResponse.json({ events: [] }, { status: 200 })
    }

    console.log("[v0] ✓ Database connection created successfully")

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const cameraId = searchParams.get("camera_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    console.log("[v0] Executing database query...")

    // Build dynamic query with postgres.js
    let events
    if (cameraId && startDate && endDate) {
      events = await sql`
        SELECT * FROM events 
        WHERE camera_id = ${cameraId} 
        AND ts >= ${startDate} 
        AND ts <= ${endDate}
        ORDER BY ts DESC 
        LIMIT 100
      `
    } else if (cameraId) {
      events = await sql`
        SELECT * FROM events 
        WHERE camera_id = ${cameraId}
        ORDER BY ts DESC 
        LIMIT 100
      `
    } else if (startDate && endDate) {
      events = await sql`
        SELECT * FROM events 
        WHERE ts >= ${startDate} 
        AND ts <= ${endDate}
        ORDER BY ts DESC 
        LIMIT 100
      `
    } else {
      events = await sql`
        SELECT * FROM events 
        ORDER BY ts DESC 
        LIMIT 100
      `
    }

    console.log("[v0] ✓ Found", events.length, "events")

    return NextResponse.json({ events })
  } catch (error) {
    console.error("[v0] ✗ Error fetching events:", error)
    return NextResponse.json(
      {
        events: [],
        error: error instanceof Error ? error.message : String(error),
        hint: "Ensure DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD are set in Docker environment",
      },
      { status: 500 },
    )
  } finally {
    if (sql) {
      await sql.end()
    }
  }
}

export async function DELETE(request: Request) {
  let sql: ReturnType<typeof postgres> | null = null

  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("id")

    if (!eventId) {
      return NextResponse.json({ success: false, error: "Event ID required" }, { status: 400 })
    }

    sql = createSql()

    if (!sql) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 })
    }

    await sql`DELETE FROM events WHERE id = ${eventId}`

    console.log("[v0] ✓ Deleted event:", eventId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] ✗ Error deleting event:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  } finally {
    if (sql) {
      await sql.end()
    }
  }
}
