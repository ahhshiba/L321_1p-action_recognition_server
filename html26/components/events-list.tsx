"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { User, Car, Package, Dog } from "lucide-react"

const events = [
  { id: 1, type: "person", camera: "Front Door", time: "2 min ago", icon: User, confidence: 98 },
  { id: 2, type: "vehicle", camera: "Driveway", time: "5 min ago", icon: Car, confidence: 95 },
  { id: 3, type: "person", camera: "Backyard", time: "12 min ago", icon: User, confidence: 92 },
  { id: 4, type: "package", camera: "Front Door", time: "18 min ago", icon: Package, confidence: 88 },
  { id: 5, type: "animal", camera: "Pool Area", time: "25 min ago", icon: Dog, confidence: 85 },
  { id: 6, type: "person", camera: "Side Gate", time: "32 min ago", icon: User, confidence: 96 },
  { id: 7, type: "vehicle", camera: "Driveway", time: "45 min ago", icon: Car, confidence: 94 },
  { id: 8, type: "person", camera: "Garage", time: "1 hour ago", icon: User, confidence: 91 },
]

export function EventsList() {
  return (
    <Card className="h-full bg-card border-border">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Recent Events</h2>
        <p className="text-xs text-muted-foreground mt-1">AI Detection Activity</p>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-4 space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <event.icon className="h-5 w-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground capitalize">{event.type}</span>
                  <Badge variant="outline" className="text-xs border-primary/20 text-primary">
                    {event.confidence}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{event.camera}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{event.time}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}
