import { NextResponse } from "next/server"

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "/app/share/recordings"

interface RecordingFile {
  path: string
  filename: string
  cameraId: string
  timestamp: string
  date: string
  time: string
  size: string
}

interface CameraRecordings {
  cameraId: string
  recordings: RecordingFile[]
}

export async function GET() {
  try {
    console.log("[v0] Scanning recordings directory:", RECORDINGS_DIR)

    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      // Check if directory exists
      try {
        await fs.access(RECORDINGS_DIR)
      } catch {
        console.log("[v0] Recordings directory doesn't exist:", RECORDINGS_DIR)
        return NextResponse.json({ cameras: [] })
      }

      // Scan directory structure: camera_ID/year-month/date/hour-minute-second.mkv
      const cameraMap = new Map<string, RecordingFile[]>()

      const cameraFolders = await fs.readdir(RECORDINGS_DIR)

      for (const cameraId of cameraFolders) {
        const cameraPath = path.join(RECORDINGS_DIR, cameraId)
        const stat = await fs.stat(cameraPath)

        if (!stat.isDirectory()) continue

        console.log(`[v0] Scanning camera folder: ${cameraId}`)

        // Scan year-month folders
        const yearMonthFolders = await fs.readdir(cameraPath)

        for (const yearMonth of yearMonthFolders) {
          const yearMonthPath = path.join(cameraPath, yearMonth)
          const ymStat = await fs.stat(yearMonthPath)

          if (!ymStat.isDirectory()) continue

          // Scan date folders
          const dateFolders = await fs.readdir(yearMonthPath)

          for (const dateFolder of dateFolders) {
            const datePath = path.join(yearMonthPath, dateFolder)
            const dateStat = await fs.stat(datePath)

            if (!dateStat.isDirectory()) continue

            // Scan video files
            const files = await fs.readdir(datePath)

            for (const file of files) {
              if (!file.endsWith(".mp4")) continue

              const filePath = path.join(datePath, file)
              const fileStat = await fs.stat(filePath)

              const timeMatch = file.match(/^(\d{2})-(\d{2})-(\d{2})\.mp4$/)
              const timeStr = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : file

              // Format size
              const sizeInMB = (fileStat.size / (1024 * 1024)).toFixed(2)

              // Relative path for API
              const relativePath = path.join(cameraId, yearMonth, dateFolder, file)

              const recording: RecordingFile = {
                path: relativePath,
                filename: file,
                cameraId: cameraId,
                timestamp: `${dateFolder} ${timeStr}`,
                date: dateFolder,
                time: timeStr,
                size: `${sizeInMB} MB`,
              }

              if (!cameraMap.has(cameraId)) {
                cameraMap.set(cameraId, [])
              }
              cameraMap.get(cameraId)!.push(recording)
            }
          }
        }
      }

      // Convert to array format
      const cameras: CameraRecordings[] = Array.from(cameraMap.entries()).map(([cameraId, recordings]) => ({
        cameraId,
        recordings: recordings.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      }))

      console.log(`[v0] ✓ Found ${cameras.length} cameras with recordings`)
      return NextResponse.json({ cameras })
    } catch (fsError) {
      console.error("[v0] File system error:", fsError)
      return NextResponse.json({ cameras: [], error: String(fsError) })
    }
  } catch (error) {
    console.error("[v0] ✗ Error scanning recordings:", error)
    return NextResponse.json({ cameras: [], error: String(error) }, { status: 500 })
  }
}
