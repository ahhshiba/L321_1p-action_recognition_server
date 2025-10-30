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
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    if (!camera.enabled) return

    const initWebRTC = async () => {
      if (!videoRef.current) return

      try {
        setConnectionError(null)

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        })
        pcRef.current = pc

        pc.addTransceiver("video", { direction: "recvonly" })
        pc.addTransceiver("audio", { direction: "recvonly" })

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0]
            setIsConnected(true)
          }
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const whepUrl = camera.streamUrl

        const response = await fetch(whepUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        })

        if (!response.ok) {
          throw new Error(`WHEP endpoint returned ${response.status}. Make sure Frigate server is running.`)
        }

        const contentType = response.headers.get("content-type")
        if (!contentType?.includes("application/sdp")) {
          throw new Error("Invalid response from WHEP endpoint. Expected SDP, got " + contentType)
        }

        const answerSdp = await response.text()

        if (!answerSdp.includes("v=0") || !answerSdp.includes("m=")) {
          throw new Error("Invalid SDP response from server")
        }

        await pc.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to connect to camera stream"
        setConnectionError(errorMessage)
        setIsConnected(false)
      }
    }

    initWebRTC()

    return () => {
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
    }
  }, [camera.id, camera.streamUrl, camera.enabled])

  return (
    <Card className="overflow-hidden bg-card border-border group relative">
      <div className="relative aspect-video bg-secondary">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

        {connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/95 p-4">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-center text-muted-foreground max-w-[250px]">{connectionError}</p>
            <p className="text-xs text-center text-muted-foreground mt-2">Stream URL: {camera.streamUrl}</p>
          </div>
        )}

        {camera.detections && camera.detections > 0 && (
          <div className="absolute top-2 right-2">
            <Badge variant="destructive" className="bg-destructive/90">
              {camera.detections} {camera.detections === 1 ? "Detection" : "Detections"}
            </Badge>
          </div>
        )}

        <Button
          size="icon"
          variant="ghost"
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        <div className="absolute bottom-2 left-2 flex items-center gap-2">
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

        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
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
