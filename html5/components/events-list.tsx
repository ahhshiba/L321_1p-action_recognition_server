"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { User, Car, Package, Dog } from "lucide-react"
import { useEffect, useState } from "react"

interface Event {
  id: string
  cameraId: string
  cameraName: string
  type: string
  timestamp: string
  thumbnail?: string
  score: number
  zone?: string
}

const iconMap: Record<string, typeof User> = {
  person: User,
  car: Car,
  package: Package,
  dog: Dog,
  cat: Dog, // Using Dog icon for cat as well
  animal: Dog,
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
}

export function EventsList() {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await fetch("/data/events.json")
        const data = await response.json()
        if (data.events) {
          setEvents(data.events.slice(0, 5))
        }
      } catch (error) {
        console.error("[v0] Failed to load events:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadEvents()
  }, [])

  return (
    <Card className="h-full bg-card border-border">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Recent Events</h2>
        <p className="text-xs text-muted-foreground mt-1">AI Detection Activity</p>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No events found</div>
          ) : (
            events.map((event) => {
              const Icon = iconMap[event.type] || User
              const confidence = Math.round(event.score * 100)

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground capitalize">{event.type}</span>
                      <Badge variant="outline" className="text-xs border-primary/20 text-primary">
                        {confidence}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{event.cameraName}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{formatTimestamp(event.timestamp)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}
