"use client"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Download, Trash2, Calendar, Database, ChevronRight, Video } from "lucide-react"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Event {
  id: string
  cameraId: string
  cameraName: string
  date: string
  startTime: string
  duration: string
  size: string
  path: string
  thumbnail: string
  className: string
  score: number
  ts: string
}

interface CameraEvents {
  cameraId: string
  cameraName: string
  events: Event[]
}

interface DbStatus {
  connected: boolean
  eventsCount?: number
  databaseUrl?: string
  error?: string
  details?: string
  envStatus?: Record<string, boolean>
  message?: string
}

export default function EventsPage() {
  const [cameraEvents, setCameraEvents] = useState<CameraEvents[]>([])
  const [loading, setLoading] = useState(true)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null)
  const [showDbStatus, setShowDbStatus] = useState(false)
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const response = await fetch("/api/events")
      if (!response.ok) throw new Error("Failed to fetch events")
      const data = await response.json()

      const formattedEvents = (data.events || []).map((event: any) => ({
        id: event.id,
        cameraId: event.camera_id,
        cameraName: `Camera ${event.camera_id}`,
        date: new Date(event.ts).toISOString().split("T")[0],
        startTime: new Date(event.ts).toLocaleTimeString(),
        duration: "N/A",
        size: "N/A",
        path: event.video_path || event.thumbnail,
        thumbnail: event.thumbnail,
        className: event.class_name,
        score: event.score || 0,
        ts: event.ts,
      }))

      const groupedByCamera: Record<string, Event[]> = {}
      formattedEvents.forEach((event: Event) => {
        if (!groupedByCamera[event.cameraId]) {
          groupedByCamera[event.cameraId] = []
        }
        groupedByCamera[event.cameraId].push(event)
      })

      const cameraEventsArray = Object.entries(groupedByCamera).map(([cameraId, events]) => ({
        cameraId,
        cameraName: `Camera ${cameraId}`,
        events: events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
      }))

      setCameraEvents(cameraEventsArray)
    } catch (error) {
      console.error("Failed to load events:", error)
      setCameraEvents([])
    } finally {
      setLoading(false)
    }
  }

  function toggleCamera(cameraId: string) {
    setExpandedCamera(expandedCamera === cameraId ? null : cameraId)
    setPlayingVideo(null)
  }

  async function checkDatabaseStatus() {
    setCheckingStatus(true)
    try {
      const response = await fetch("/api/events/status")
      const data = await response.json()
      setDbStatus(data)
      setShowDbStatus(true)
    } catch (error) {
      setDbStatus({
        connected: false,
        error: "Failed to check database status",
        details: error instanceof Error ? error.message : String(error),
      })
      setShowDbStatus(true)
    } finally {
      setCheckingStatus(false)
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Are you sure you want to delete this event?")) return

    try {
      const response = await fetch(`/api/events?id=${eventId}`, { method: "DELETE" })
      if (response.ok) {
        loadEvents()
      }
    } catch (error) {
      console.error("Failed to delete event:", error)
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <p className="text-muted-foreground">Loading events...</p>
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
              <h1 className="text-2xl font-bold text-foreground">Events</h1>
              <p className="text-sm text-muted-foreground">View detection events with video clips</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={checkDatabaseStatus} disabled={checkingStatus}>
                <Database className="mr-2 h-4 w-4" />
                {checkingStatus ? "Checking..." : "Check SQL Status"}
              </Button>
              <Button variant="outline" onClick={loadEvents}>
                <Calendar className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {cameraEvents.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">No events found</p>
                <Button variant="outline" onClick={checkDatabaseStatus}>
                  <Database className="mr-2 h-4 w-4" />
                  Check Database Status
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {cameraEvents.map((camera) => (
                <Card key={camera.cameraId} className="p-4 bg-card border-border">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleCamera(camera.cameraId)}
                  >
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{camera.cameraName}</h3>
                        <p className="text-sm text-muted-foreground">{camera.events.length} events</p>
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
                      {camera.events.map((event) => (
                        <div key={event.id}>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="h-16 w-24 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                                {event.thumbnail && (
                                  <img
                                    src={`/api/events/media?file=${event.thumbnail}`}
                                    alt={`${event.cameraName} event`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none"
                                    }}
                                  />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary">{event.className}</Badge>
                                  <Badge variant="outline">{formatDate(event.date)}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Score: {(event.score * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-foreground">{event.path}</span>
                                </div>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  <span>{event.startTime}</span>
                                  <span>Duration: {event.duration}</span>
                                  <span>Size: {event.size}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPlayingVideo(playingVideo === event.path ? null : event.path)
                                }}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                {playingVideo === event.path ? "Close" : "Play"}
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteEvent(event.id)
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {playingVideo === event.path && (
                            <div className="mt-3 border border-border rounded-lg overflow-hidden">
                              <video
                                controls
                                autoPlay
                                className="w-full bg-black"
                                src={`/api/events/stream?file=${playingVideo}`}
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

      <Dialog open={showDbStatus} onOpenChange={setShowDbStatus}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Connection Status
            </DialogTitle>
            <DialogDescription>Check your PostgreSQL database connection and configuration</DialogDescription>
          </DialogHeader>

          {dbStatus && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${dbStatus.connected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="font-semibold">{dbStatus.connected ? "Connected" : "Disconnected"}</span>
              </div>

              {dbStatus.connected ? (
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="font-medium text-green-700 dark:text-green-400">{dbStatus.message}</p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Events Count:</span>
                      <span className="font-mono">{dbStatus.eventsCount}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Database URL:</span>
                      <span className="font-mono text-xs">{dbStatus.databaseUrl}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2">
                    <p className="font-semibold text-red-700 dark:text-red-400">{dbStatus.error}</p>
                    {dbStatus.details && <p className="text-sm text-muted-foreground">{dbStatus.details}</p>}
                  </div>

                  {dbStatus.envStatus && (
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">Environment Variables Status:</p>
                      <div className="grid gap-1">
                        {Object.entries(dbStatus.envStatus).map(([key, value]) => (
                          <div key={key} className="flex justify-between p-2 bg-muted rounded">
                            <span className="font-mono text-xs">{key}</span>
                            <span className={value ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                              {value ? "✓ Set" : "✗ Missing"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-3">
                    <p className="font-semibold text-blue-700 dark:text-blue-400">
                      Fix: Add database environment variables to Docker Compose
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add these environment variables to your{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">htmlv2</code> service in docker-compose.yml:
                    </p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                      {`htmlv2:
  environment:
    GO2RTC_API_URL: http://go2rtc:1984
    NEXT_PUBLIC_GO2RTC_URL: http://localhost:1984
    CAMERAS_JSON: /app/share/cameras.json
    # Add these database variables:
    DATABASE_HOST: postgres
    DATABASE_PORT: "5432"
    DATABASE_NAME: vision
    DATABASE_USER: vision_user
    DATABASE_PASSWORD: vision_pass`}
                    </pre>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      After updating docker-compose.yml, restart the container:{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">docker-compose restart htmlv2</code>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowDbStatus(false)}>
                  Close
                </Button>
                {!dbStatus.connected && (
                  <Button
                    onClick={async () => {
                      setShowDbStatus(false)
                      await checkDatabaseStatus()
                    }}
                  >
                    Recheck Status
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
