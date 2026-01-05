"use client"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Download, Folder, Calendar, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

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

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<CameraRecordings[]>([])
  const [loading, setLoading] = useState(true)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null)

  useEffect(() => {
    loadRecordings()
  }, [])

  async function loadRecordings() {
    try {
      const response = await fetch("/api/recordings/scan")
      if (!response.ok) throw new Error("Failed to fetch recordings")
      const data = await response.json()
      setRecordings(data.cameras || [])
    } catch (error) {
      console.error("Failed to load recordings:", error)
      setRecordings([])
    } finally {
      setLoading(false)
    }
  }

  function toggleCamera(cameraId: string) {
    setExpandedCamera(expandedCamera === cameraId ? null : cameraId)
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <p className="text-muted-foreground">Scanning recordings directory...</p>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Recordings</h1>
              <p className="text-sm text-muted-foreground">Browse continuous recordings from all cameras</p>
            </div>
            <Button variant="outline" onClick={loadRecordings}>
              <Calendar className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {recordings.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No recordings found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {recordings.map((camera) => (
                <Card key={camera.cameraId} className="p-4 bg-card border-border">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleCamera(camera.cameraId)}
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Camera {camera.cameraId}</h3>
                        <p className="text-sm text-muted-foreground">{camera.recordings.length} recordings</p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        expandedCamera === camera.cameraId ? "rotate-90" : ""
                      }`}
                    />
                  </div>

                  {expandedCamera === camera.cameraId && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      {camera.recordings.map((recording, idx) => (
                        <div key={idx}>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <Play className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{recording.filename}</p>
                                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                  <span>{recording.date}</span>
                                  <span>{recording.time}</span>
                                  <span>{recording.size}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPlayingVideo(playingVideo === recording.path ? null : recording.path)}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                {playingVideo === recording.path ? "Close" : "Play"}
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {playingVideo === recording.path && (
                            <div className="mt-3 border border-border rounded-lg overflow-hidden">
                              <video
                                controls
                                autoPlay
                                className="w-full bg-black"
                                src={`/api/recordings/stream?file=${playingVideo}`}
                                onEnded={() => setPlayingVideo(null)}
                                onError={() => {
                                  console.error("Video failed to load:", playingVideo)
                                }}
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
