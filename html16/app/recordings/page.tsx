"use client"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Download, Trash2, Calendar } from "lucide-react"
import { useEffect, useState } from "react"

interface Recording {
  id: string
  cameraId: string
  cameraName: string
  date: string
  startTime: string
  endTime: string
  duration: string
  size: string
  events: number
  path: string
  thumbnail: string
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)

  useEffect(() => {
    loadRecordings()
  }, [])

  async function loadRecordings() {
    try {
      const response = await fetch("/api/recordings")
      if (!response.ok) throw new Error("Failed to fetch recordings")
      const data = await response.json()
      setRecordings(data.recordings || [])
    } catch (error) {
      console.error("Failed to load recordings:", error)
      setRecordings([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteRecording(recordingId: string) {
    if (!confirm("Are you sure you want to delete this recording?")) return

    try {
      const response = await fetch(`/api/recordings?id=${recordingId}`, { method: "DELETE" })
      if (response.ok) {
        setRecordings(recordings.filter((r) => r.id !== recordingId))
      }
    } catch (error) {
      console.error("Failed to delete recording:", error)
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
            <p className="text-muted-foreground">Loading recordings...</p>
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
              <p className="text-sm text-muted-foreground">Browse and manage recorded footage</p>
            </div>
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Select Date
            </Button>
          </div>

          {recordings.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No recordings found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {recordings.map((recording) => (
                <Card key={recording.id} className="p-6 bg-card border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-32 bg-muted rounded-lg overflow-hidden relative">
                        <img
                          src={
                            recording.thumbnail
                              ? `/api/recordings/media?file=${recording.thumbnail}`
                              : "/placeholder.svg"
                          }
                          alt={`${recording.cameraName} recording`}
                          className="w-full h-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none"
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-foreground">{recording.cameraName}</h3>
                          <Badge variant="outline">{formatDate(recording.date)}</Badge>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>Duration: {recording.duration}</span>
                          <span>Size: {recording.size}</span>
                          <span>Events: {recording.events}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => setPlayingVideo(recording.path)}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDeleteRecording(recording.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {playingVideo === recording.path && (
                    <div className="mt-4">
                      <video
                        controls
                        className="w-full rounded-lg bg-black"
                        src={`/api/recordings/media?file=${recording.path}`}
                        onError={() => {
                          console.error("Video failed to load:", recording.path)
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
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
