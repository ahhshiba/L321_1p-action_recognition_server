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

export async function GET() {
  let sql: ReturnType<typeof postgres> | null = null

  try {
    console.log("[v0] Checking database connection status")

    const dbHost = process.env.DATABASE_HOST
    const dbPort = process.env.DATABASE_PORT
    const dbName = process.env.DATABASE_NAME
    const dbUser = process.env.DATABASE_USER
    const dbPass = process.env.DATABASE_PASSWORD

    console.log("[v0] Current environment:")
    console.log("[v0] - DATABASE_HOST:", dbHost || "❌ NOT SET")
    console.log("[v0] - DATABASE_PORT:", dbPort || "❌ NOT SET")
    console.log("[v0] - DATABASE_NAME:", dbName || "❌ NOT SET")
    console.log("[v0] - DATABASE_USER:", dbUser || "❌ NOT SET")
    console.log("[v0] - DATABASE_PASSWORD:", dbPass ? "✓ SET" : "❌ NOT SET")

    const envStatus = {
      DATABASE_HOST: !!dbHost,
      DATABASE_PORT: !!dbPort,
      DATABASE_NAME: !!dbName,
      DATABASE_USER: !!dbUser,
      DATABASE_PASSWORD: !!dbPass,
    }

    sql = createSql()

    if (!sql) {
      console.log("[v0] ✗ Cannot create database connection - missing environment variables")
      return NextResponse.json({
        connected: false,
        error: "Database connection not configured",
        details:
          "Please set DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD in your Docker Compose environment",
        envStatus,
        constructedUrl: null,
      })
    }

    const connectionString = `postgresql://${dbUser}:****@${dbHost}:${dbPort}/${dbName}`
    console.log("[v0] ✓ Attempting connection to:", connectionString)

    const result = await sql`SELECT COUNT(*) as count FROM events`
    const count = result[0]?.count || 0

    console.log("[v0] ✓ Database connection successful, events count:", count)

    return NextResponse.json({
      connected: true,
      eventsCount: Number(count),
      databaseUrl: connectionString,
      envStatus,
      message: "Database connection successful",
    })
  } catch (error) {
    console.error("[v0] ✗ Database connection failed:", error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    const isConnectionError = errorMessage.includes("ECONNREFUSED") || errorMessage.includes("timeout")

    return NextResponse.json(
      {
        connected: false,
        error: errorMessage,
        details: isConnectionError
          ? "Cannot reach database server. Ensure postgres container is running and accessible from html24_web container"
          : "Failed to query database. Check if events table exists and user has permissions",
        troubleshooting: [
          "Verify postgres container is running: docker ps | grep postgres",
          "Check network connectivity: docker exec html24_web ping postgres",
          "Verify environment variables: docker exec html24_web env | grep DATABASE",
          "Check postgres logs: docker logs postgres",
        ],
      },
      { status: 500 },
    )
  } finally {
    if (sql) {
      await sql.end()
    }
  }
}
