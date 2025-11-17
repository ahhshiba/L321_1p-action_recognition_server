"use client"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Download, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

interface Event {
  id: string
  cameraId: string
  cameraName: string
  type: string
  timestamp: string
  thumbnail: string
  score: number
  zone: string
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const response = await fetch("/api/events")
      if (!response.ok) throw new Error("Failed to fetch events")
      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error("Failed to load events:", error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Are you sure you want to delete this event?")) return

    try {
      const response = await fetch(`/api/events?id=${eventId}`, { method: "DELETE" })
      if (response.ok) {
        setEvents(events.filter((e) => e.id !== eventId))
      }
    } catch (error) {
      console.error("Failed to delete event:", error)
    }
  }

  function handleViewEvent(event: Event) {
    setSelectedEvent(event)
    setIsDialogOpen(true)
  }

  function getRelativeTime(timestamp: string) {
    const now = new Date()
    const eventTime = new Date(timestamp)
    const diffMs = now.getTime() - eventTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    return eventTime.toLocaleDateString()
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
              <p className="text-sm text-muted-foreground">View all detection events</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No events found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {events.map((event) => (
                <Card key={event.id} className="overflow-hidden bg-card border-border">
                  <div className="aspect-video bg-muted relative">
                    <img
                      src={event.thumbnail ? `/api/events/media?file=${event.thumbnail}` : "/placeholder.svg"}
                      alt={`${event.type} detected`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg?height=200&width=300"
                      }}
                    />
                    <Badge className="absolute top-2 right-2 bg-primary">{event.type}</Badge>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{event.cameraName}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(event.score * 100)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{getRelativeTime(event.timestamp)}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => handleViewEvent(event)}
                      >
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteEvent(event.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Event Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={
                    selectedEvent.thumbnail ? `/api/events/media?file=${selectedEvent.thumbnail}` : "/placeholder.svg"
                  }
                  alt={`${selectedEvent.type} detected`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg?height=400&width=600"
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Event ID</p>
                  <p className="text-sm font-medium text-foreground">{selectedEvent.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Camera</p>
                  <p className="text-sm font-medium text-foreground">{selectedEvent.cameraName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Object Type</p>
                  <Badge className="bg-primary">{selectedEvent.type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                  <p className="text-sm font-medium text-foreground">{Math.round(selectedEvent.score * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Zone</p>
                  <p className="text-sm font-medium text-foreground">{selectedEvent.zone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Timestamp</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Camera ID</p>
                  <p className="text-sm font-medium text-foreground">{selectedEvent.cameraId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Relative Time</p>
                  <p className="text-sm font-medium text-foreground">{getRelativeTime(selectedEvent.timestamp)}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 bg-transparent">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => {
                    handleDeleteEvent(selectedEvent.id)
                    setIsDialogOpen(false)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
