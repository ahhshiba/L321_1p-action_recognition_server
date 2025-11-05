"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Circle, Maximize2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState } from "react"
import type { CameraConfig } from "@/config/cameras"

interface CameraFeedProps {
  camera: CameraConfig & { detections?: number }
}

export function CameraFeed({ camera }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!camera.enabled || !videoRef.current) return

    const initProgressiveMP4 = () => {
      try {
        setConnectionError(null)
        setIsLoading(true)

        if (!camera.streamUrl || camera.streamUrl.trim() === "") {
          throw new Error("Camera stream URL is not configured")
        }

        const go2rtcUrl = process.env.NEXT_PUBLIC_GO2RTC_URL || "http://localhost:1984"
        const streamUrl = `${go2rtcUrl}/api/stream.mp4?src=${encodeURIComponent(camera.streamUrl)}`

        console.log("[v0] Loading progressive MP4 stream:", streamUrl)

        if (videoRef.current) {
          videoRef.current.src = streamUrl

          // Handle video events
          videoRef.current.onloadeddata = () => {
            console.log("[v0] Video data loaded")
            setIsConnected(true)
            setIsLoading(false)
          }

          videoRef.current.onerror = (e) => {
            console.error("[v0] Video error:", e)
            setConnectionError("Failed to load video stream. Please check go2rtc server.")
            setIsConnected(false)
            setIsLoading(false)
          }

          videoRef.current.onwaiting = () => {
            console.log("[v0] Video buffering...")
          }

          videoRef.current.onplaying = () => {
            console.log("[v0] Video playing")
            setIsConnected(true)
            setIsLoading(false)
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to connect to camera"
        console.error("[v0] Progressive MP4 initialization error:", error)
        setConnectionError(errorMessage)
        setIsConnected(false)
        setIsLoading(false)
      }
    }

    initProgressiveMP4()

    return () => {
      if (videoRef.current) {
        videoRef.current.src = ""
        videoRef.current.onloadeddata = null
        videoRef.current.onerror = null
        videoRef.current.onwaiting = null
        videoRef.current.onplaying = null
      }
    }
  }, [camera.id, camera.streamUrl, camera.enabled])

  return (
    <Card className="overflow-hidden bg-card border-border group relative">
      <div className="relative aspect-video bg-secondary">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

        {connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/95 p-4 z-10">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-center text-foreground max-w-[280px] break-words">{connectionError}</p>
            <p className="text-xs text-center text-muted-foreground mt-2">Stream: {camera.streamUrl}</p>
          </div>
        )}

        {isLoading && !connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/95 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Connecting...</p>
            </div>
          </div>
        )}

        {camera.detections && camera.detections > 0 && (
          <div className="absolute top-2 right-2 z-20">
            <Badge variant="destructive" className="bg-destructive/90">
              {camera.detections} {camera.detections === 1 ? "Detection" : "Detections"}
            </Badge>
          </div>
        )}

        <Button
          size="icon"
          variant="ghost"
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background z-20"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        <div className="absolute bottom-2 left-2 flex items-center gap-2 z-20">
          <Circle
            className={`h-2 w-2 ${
              connectionError
                ? "fill-destructive text-destructive"
                : isConnected
                  ? "fill-primary text-primary animate-pulse"
                  : "fill-muted-foreground text-muted-foreground opacity-50"
            }`}
          />
          <span className="text-xs font-medium text-foreground bg-background/80 px-2 py-1 rounded">
            {connectionError ? "ERROR" : isConnected ? "LIVE" : "CONNECTING..."}
          </span>
        </div>

        <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-20">
          {camera.detectObjects.slice(0, 3).map((obj) => (
            <Badge key={obj} variant="secondary" className="text-xs bg-background/80">
              {obj}
            </Badge>
          ))}
          {camera.detectObjects.length > 3 && (
            <Badge variant="secondary" className="text-xs bg-background/80">
              +{camera.detectObjects.length - 3}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">{camera.name}</h3>
            <p className="text-xs text-muted-foreground">{camera.location}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="text-xs border-primary/20 text-primary">
              {camera.enabled ? "Active" : "Disabled"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {camera.resolution} @ {camera.fps}fps
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
