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
  const { searchParams } = new URL(request.url)
  const cameraId = searchParams.get("camera_id")
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")

  let sql: ReturnType<typeof postgres> | null = null

  try {
    console.log("[v0] Fetching recordings from database")

    sql = createSql()

    if (!sql) {
      console.error("[v0] Database connection not configured")
      return NextResponse.json({
        recordings: [],
        error: "Database not configured. Please set database environment variables.",
      })
    }

    // Build dynamic query
    let events
    if (cameraId && startDate && endDate) {
      events = await sql`
        SELECT 
          id, camera_id, class_name, ts, thumbnail, score,
          video_path, duration, size, created_at
        FROM events
        WHERE camera_id = ${cameraId} 
        AND ts >= ${startDate} 
        AND ts <= ${endDate}
        ORDER BY ts DESC 
        LIMIT 100
      `
    } else if (cameraId) {
      events = await sql`
        SELECT 
          id, camera_id, class_name, ts, thumbnail, score,
          video_path, duration, size, created_at
        FROM events
        WHERE camera_id = ${cameraId}
        ORDER BY ts DESC 
        LIMIT 100
      `
    } else if (startDate && endDate) {
      events = await sql`
        SELECT 
          id, camera_id, class_name, ts, thumbnail, score,
          video_path, duration, size, created_at
        FROM events
        WHERE ts >= ${startDate} 
        AND ts <= ${endDate}
        ORDER BY ts DESC 
        LIMIT 100
      `
    } else {
      events = await sql`
        SELECT 
          id, camera_id, class_name, ts, thumbnail, score,
          video_path, duration, size, created_at
        FROM events
        ORDER BY ts DESC 
        LIMIT 100
      `
    }

    console.log("[v0] Query executed, found", events.length, "rows")

    const recordings = events.map((row) => ({
      id: row.id,
      cameraId: row.camera_id,
      cameraName: `Camera ${row.camera_id}`,
      date: new Date(row.ts).toISOString().split("T")[0],
      startTime: new Date(row.ts).toLocaleTimeString(),
      endTime: "",
      duration: row.duration || "Unknown",
      size: row.size || "Unknown",
      events: 1,
      path: row.video_path || `${row.id}.mkv`,
      thumbnail: row.thumbnail || "",
    }))

    console.log(`[v0] ✓ Successfully fetched ${recordings.length} recordings from database`)
    return NextResponse.json({ recordings })
  } catch (error) {
    console.error("[v0] ✗ Error fetching recordings:", error)
    return NextResponse.json(
      {
        recordings: [],
        error: String(error),
      },
      { status: 500 },
    )
  } finally {
    if (sql) {
      await sql.end()
    }
  }
}

interface Event {
  id: string
  camera_id: string
  class_name: string
  ts: string
  thumbnail: string | null
  score: number | null
  video_path: string | null
  duration: string | null
  size: string | null
  created_at: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] Inserting new recording/event:", body)

    let sql: ReturnType<typeof postgres> | null = null

    sql = createSql()

    if (!sql) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not configured",
        },
        { status: 500 },
      )
    }

    try {
      const query = `
        INSERT INTO events (
          id, camera_id, class_name, ts, thumbnail, score, 
          video_path, duration, size
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 
          $7, $8, $9
        )
        RETURNING *
      `
      const params = [
        body.id,
        body.camera_id,
        body.class_name,
        body.ts,
        body.thumbnail || null,
        body.score || null,
        body.video_path || null,
        body.duration || null,
        body.size || null,
      ]

      const result = await sql.unsafe(query, params)

      console.log("[v0] ✓ Successfully inserted recording")
      return NextResponse.json({ success: true, data: result[0] })
    } catch (dbError) {
      console.error("[v0] Database insert error:", dbError)
      return NextResponse.json(
        {
          success: false,
          error: String(dbError),
        },
        { status: 500 },
      )
    } finally {
      if (sql) {
        await sql.end()
      }
    }
  } catch (error) {
    console.error("[v0] ✗ Error inserting recording:", error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recordingId = searchParams.get("id")

    if (!recordingId) {
      return NextResponse.json(
        {
          success: false,
          error: "Recording ID required",
        },
        { status: 400 },
      )
    }

    let sql: ReturnType<typeof postgres> | null = null

    sql = createSql()

    if (!sql) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not configured",
        },
        { status: 500 },
      )
    }

    try {
      const query = `
        DELETE FROM events WHERE id = $1
      `
      const params = [recordingId]

      await sql.unsafe(query, params)

      console.log("[v0] ✓ Successfully deleted recording:", recordingId)
      return NextResponse.json({ success: true })
    } catch (dbError) {
      console.error("[v0] Database delete error:", dbError)
      return NextResponse.json(
        {
          success: false,
          error: String(dbError),
        },
        { status: 500 },
      )
    } finally {
      if (sql) {
        await sql.end()
      }
    }
  } catch (error) {
    console.error("[v0] ✗ Error deleting recording:", error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    )
  }
}
