"use client"

import type React from "react"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Video, Settings, Trash2, RefreshCw, AlertCircle, ChevronUp, X, Activity, Circle, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useRef, useEffect } from "react"
import { useCameraConfig } from "@/lib/use-camera-config"
import type { VirtualFence } from "@/config/cameras"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Model {
  type: string
  name: string
  classes: { id: number; name: string }[]
}

interface CameraConfig {
  id: string
  name: string
  rtspUrl: string
  location: string
  resolution: string
  fps: number
  detectObjects: string[]
  recordingEnabled: boolean
  snapshotsEnabled: boolean
  motionDetection: boolean
  minConfidence: number
  modelID?: string
  virtualFences?: VirtualFence[]
}

export default function CamerasPage() {
  const [open, setOpen] = useState(false)
  const [cameraName, setCameraName] = useState("")
  const [cameraUrl, setCameraUrl] = useState("")
  const { cameras, availableDetectionObjects, updateCameras } = useCameraConfig()
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null)
  const [editingFence, setEditingFence] = useState<{ cameraId: string; fenceIndex: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoConnected, setVideoConnected] = useState<Record<string, boolean>>({})
  const [videoLoading, setVideoLoading] = useState<Record<string, boolean>>({})
  const [videoError, setVideoError] = useState<Record<string, string | null>>({})

  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Record<string, string>>({})

  const [draggingPoint, setDraggingPoint] = useState<number | null>(null)
  const [tempPoints, setTempPoints] = useState<{ x: number; y: number }[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [healthStatus, setHealthStatus] = useState<{
    status: "ok" | "error" | "checking" | null
    message: string
    url?: string
    streamCount?: number
    streams?: string[]
  }>({ status: null, message: "" })

  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch("/api/models")
        const data = await response.json()
        setModels(data.models.filter((m: any) => m.type.toLowerCase() === "object detection"))

        const initialSelections: Record<string, string> = {}
        cameras.forEach((cam) => {
          if (cam.modelID) {
            initialSelections[cam.id] = cam.modelID
          }
        })
        setSelectedModel(initialSelections)
      } catch (error) {
        console.error("[v0] Failed to load models:", error)
      }
    }
    loadModels()
  }, [cameras])

  const getAvailableClasses = (cameraId: string): string[] => {
    const modelName = selectedModel[cameraId]
    console.log("[v0] getAvailableClasses called:", { cameraId, modelName, selectedModel })

    if (!modelName) return availableDetectionObjects

    const model = models.find((m) => m.name === modelName)
    console.log("[v0] Found model:", model ? model.name : "not found", "classes count:", model?.classes.length || 0)
    return model ? model.classes.map((c) => c.name) : availableDetectionObjects
  }

  const handleModelChange = (cameraId: string, modelName: string) => {
    setSelectedModel({ ...selectedModel, [cameraId]: modelName })

    updateCameras(
      cameras.map((cam) => {
        if (cam.id === cameraId) {
          const updatedFences =
            cam.virtualFences?.map((fence) => ({
              ...fence,
              detectObjects: [], // Clear detectObjects array when model changes
            })) || []

          return {
            ...cam,
            modelID: modelName,
            virtualFences: updatedFences,
          }
        }
        return cam
      }),
    )
  }

  const checkGo2rtcHealth = async () => {
    setHealthStatus({ status: "checking", message: "Checking go2rtc connection..." })

    try {
      const response = await fetch("/api/go2rtc/health")
      const data = await response.json()

      if (response.ok && data.status === "ok") {
        setHealthStatus({
          status: "ok",
          message: data.message,
          url: data.url,
          streamCount: data.streamCount,
          streams: data.streams,
        })
      } else {
        setHealthStatus({
          status: "error",
          message: data.message || "Failed to connect to go2rtc",
          url: data.url,
        })
      }
    } catch (error) {
      setHealthStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to check go2rtc health",
      })
    }
  }

  const handleAddCamera = async () => {
    try {
      const response = await fetch("/api/cameras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cameraName,
          rtspUrl: cameraUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add camera")
      }

      const { camera: newCamera } = await response.json()
      console.log("[v0] Camera registered with go2rtc:", newCamera)

      updateCameras([
        ...cameras,
        {
          ...newCamera,
          location: "New Location",
          resolution: "1920x1080",
          fps: 30,
          detectObjects: ["person"],
          recordingEnabled: true,
          snapshotsEnabled: true,
          motionDetection: true,
          minConfidence: 70,
          virtualFences: [],
        },
      ])

      setOpen(false)
      setCameraName("")
      setCameraUrl("")
    } catch (error) {
      console.error("[v0] Failed to add camera:", error)
      alert(error instanceof Error ? error.message : "Failed to add camera")
    }
  }

  const handleDeleteCamera = async (cameraId: string) => {
    if (!confirm("Are you sure you want to delete this camera?")) return

    try {
      const response = await fetch(`/api/cameras/${encodeURIComponent(cameraId)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete camera")
      }

      console.log("[v0] Camera deleted from go2rtc:", cameraId)

      const updatedCameras = cameras.filter((cam) => cam.id !== cameraId)
      updateCameras(updatedCameras)

      if (expandedCamera === cameraId) {
        setExpandedCamera(null)
      }
    } catch (error) {
      console.error("[v0] Failed to delete camera:", error)
      alert(error instanceof Error ? error.message : "Failed to delete camera")
    }
  }

  const addVirtualFence = (cameraId: string) => {
    updateCameras(
      cameras.map((cam) => {
        if (cam.id === cameraId) {
          const newFence: VirtualFence = {
            name: `Zone ${(cam.virtualFences?.length || 0) + 1}`,
            points: [
              { x: 0.25, y: 0.25 },
              { x: 0.75, y: 0.25 },
              { x: 0.75, y: 0.75 },
              { x: 0.25, y: 0.75 },
            ],
            enabled: true,
            detectObjects: ["person"],
          }
          return {
            ...cam,
            virtualFences: [...(cam.virtualFences || []), newFence],
          }
        }
        return cam
      }),
    )
  }

  const removeVirtualFence = (cameraId: string, fenceIndex: number) => {
    updateCameras(
      cameras.map((cam) => {
        if (cam.id === cameraId) {
          return {
            ...cam,
            virtualFences: cam.virtualFences?.filter((_, i) => i !== fenceIndex),
          }
        }
        return cam
      }),
    )
  }

  const toggleFenceEnabled = (cameraId: string, fenceIndex: number) => {
    updateCameras(
      cameras.map((cam) => {
        if (cam.id === cameraId && cam.virtualFences) {
          const updatedFences = [...cam.virtualFences]
          updatedFences[fenceIndex] = {
            ...updatedFences[fenceIndex],
            enabled: !updatedFences[fenceIndex].enabled,
          }
          return { ...cam, virtualFences: updatedFences }
        }
        return cam
      }),
    )
  }

  const updateFenceObjects = (cameraId: string, fenceIndex: number, objects: string[]) => {
    updateCameras(
      cameras.map((cam) => {
        if (cam.id === cameraId && cam.virtualFences) {
          const updatedFences = [...cam.virtualFences]
          updatedFences[fenceIndex] = {
            ...updatedFences[fenceIndex],
            detectObjects: objects,
          }
          return { ...cam, virtualFences: updatedFences }
        }
        return cam
      }),
    )
  }

  const saveFenceCoordinates = () => {
    if (!editingFence || tempPoints.length === 0) return

    updateCameras(
      cameras.map((cam) => {
        if (cam.id === editingFence.cameraId && cam.virtualFences) {
          const updatedFences = [...cam.virtualFences]
          updatedFences[editingFence.fenceIndex] = {
            ...updatedFences[editingFence.fenceIndex],
            points: tempPoints,
          }
          return { ...cam, virtualFences: updatedFences }
        }
        return cam
      }),
    )
    setHasUnsavedChanges(false)
  }

  const handleDoneEditing = () => {
    if (hasUnsavedChanges && tempPoints.length > 0) {
      saveFenceCoordinates()
    }
    setEditingFence(null)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !editingFence) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    const camera = cameras.find((c) => c.id === editingFence.cameraId)
    const fence = camera?.virtualFences?.[editingFence.fenceIndex]
    if (!fence) return

    const points = tempPoints.length > 0 ? tempPoints : fence.points

    const pointIndex = points.findIndex((point) => {
      const px = point.x * rect.width
      const py = point.y * rect.height
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const distance = Math.sqrt((px - mx) ** 2 + (py - my) ** 2)
      return distance < 20
    })

    if (pointIndex !== -1) {
      setDraggingPoint(pointIndex)
      if (tempPoints.length === 0) {
        setTempPoints(fence.points)
      }
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingPoint === null || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))

    const newPoints = [...tempPoints]
    newPoints[draggingPoint] = { x, y }
    setTempPoints(newPoints)
    setHasUnsavedChanges(true)
  }

  const handleCanvasMouseUp = () => {
    setDraggingPoint(null)
  }

  const handleEditZoneClick = (cameraId: string, fenceIndex: number) => {
    console.log("[v0] Edit Zone clicked:", { cameraId, fenceIndex, currentEditing: editingFence })

    if (editingFence?.cameraId === cameraId && editingFence?.fenceIndex === fenceIndex) {
      console.log("[v0] Finishing edit mode")
      handleDoneEditing()
    } else {
      console.log("[v0] Starting edit mode")
      setEditingFence({ cameraId, fenceIndex })
      setExpandedCamera(cameraId)
    }
  }

  useEffect(() => {
    if (!canvasRef.current || !editingFence) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const camera = cameras.find((c) => c.id === editingFence.cameraId)
    const fence = camera?.virtualFences?.[editingFence.fenceIndex]
    if (!fence) return

    const points = tempPoints.length > 0 ? tempPoints : fence.points

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.beginPath()
    points.forEach((point, i) => {
      const x = point.x * canvas.width
      const y = point.y * canvas.height
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.closePath()
    ctx.strokeStyle = fence.enabled ? "#3b82f6" : "#6b7280"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = fence.enabled ? "rgba(59, 130, 246, 0.2)" : "rgba(107, 114, 128, 0.2)"
    ctx.fill()

    points.forEach((point, index) => {
      const x = point.x * canvas.width
      const y = point.y * canvas.height

      ctx.beginPath()
      ctx.arc(x, y, 10, 0, Math.PI * 2)
      ctx.fillStyle = draggingPoint === index ? "#ef4444" : "#ffffff"
      ctx.fill()
      ctx.strokeStyle = fence.enabled ? "#3b82f6" : "#6b7280"
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = "#000000"
      ctx.font = "12px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText((index + 1).toString(), x, y)
    })
  }, [editingFence, cameras, tempPoints, draggingPoint])

  useEffect(() => {
    if (editingFence) {
      const camera = cameras.find((c) => c.id === editingFence.cameraId)
      const fence = camera?.virtualFences?.[editingFence.fenceIndex]
      if (fence && fence.points) {
        setTempPoints([...fence.points])
      }
    } else {
      setTempPoints([])
    }
    setHasUnsavedChanges(false)
    setDraggingPoint(null)
  }, [editingFence, cameras])

  useEffect(() => {
    if (!expandedCamera || !videoRef.current) return

    const camera = cameras.find((c) => c.id === expandedCamera)
    if (!camera || !camera.enabled || !camera.streamUrl) return

    const initProgressiveMP4 = () => {
      try {
        setVideoError({ ...videoError, [expandedCamera]: null })
        setVideoLoading({ ...videoLoading, [expandedCamera]: true })

        const go2rtcUrl = process.env.NEXT_PUBLIC_GO2RTC_URL || "http://localhost:1984"
        const streamUrl = `${go2rtcUrl}/api/stream.mp4?src=${encodeURIComponent(camera.streamUrl)}`

        console.log("[v0] Loading camera settings video stream:", streamUrl)

        if (videoRef.current) {
          videoRef.current.src = streamUrl

          videoRef.current.onloadeddata = () => {
            console.log("[v0] Camera settings video loaded")
            setVideoConnected({ ...videoConnected, [expandedCamera]: true })
            setVideoLoading({ ...videoLoading, [expandedCamera]: false })
          }

          videoRef.current.onerror = (e) => {
            const isPreview = window.location.hostname.includes("vusercontent.net")
            if (isPreview) {
              console.log("[v0] Video unavailable in preview mode")
              setVideoError({
                ...videoError,
                [expandedCamera]: "Preview mode: Video streams require local go2rtc server",
              })
            } else {
              console.error("[v0] Video error:", e)
              setVideoError({
                ...videoError,
                [expandedCamera]: "Failed to load video stream. Please check go2rtc server.",
              })
            }
            setVideoConnected({ ...videoConnected, [expandedCamera]: false })
            setVideoLoading({ ...videoLoading, [expandedCamera]: false })
          }

          videoRef.current.onplaying = () => {
            console.log("[v0] Camera settings video playing")
            setVideoConnected({ ...videoConnected, [expandedCamera]: true })
            setVideoLoading({ ...videoLoading, [expandedCamera]: false })
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to connect to camera"
        console.error("[v0] Video initialization error:", error)
        setVideoError({ ...videoError, [expandedCamera]: errorMessage })
        setVideoConnected({ ...videoConnected, [expandedCamera]: false })
        setVideoLoading({ ...videoLoading, [expandedCamera]: false })
      }
    }

    initProgressiveMP4()

    return () => {
      if (videoRef.current) {
        videoRef.current.src = ""
        videoRef.current.onloadeddata = null
        videoRef.current.onerror = null
        videoRef.current.onplaying = null
      }
    }
  }, [expandedCamera, cameras])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cameras</h1>
              <p className="text-sm text-muted-foreground">Manage and configure your cameras</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={checkGo2rtcHealth} disabled={healthStatus.status === "checking"}>
                <Activity className="mr-2 h-4 w-4" />
                {healthStatus.status === "checking" ? "Checking..." : "Check go2rtc"}
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Video className="mr-2 h-4 w-4" />
                    Add Camera
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Camera</DialogTitle>
                    <DialogDescription>輸入相機名稱和 RTSP 串流地址，系統會自動生成 WebRTC 端點</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Camera Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Front Door"
                        value={cameraName}
                        onChange={(e) => setCameraName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="url">RTSP URL</Label>
                      <Input
                        id="url"
                        placeholder="rtsp://127.0.0.1:8556/cam1_overlay"
                        value={cameraUrl}
                        onChange={(e) => setCameraUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">系統會自動生成對應的 WebRTC 端點用於播放</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddCamera}>Add Camera</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {healthStatus.status && (
            <Card
              className={`mb-6 p-4 ${
                healthStatus.status === "ok"
                  ? "bg-green-500/10 border-green-500/20"
                  : healthStatus.status === "error"
                    ? "bg-destructive/10 border-destructive/20"
                    : "bg-muted/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 ${
                    healthStatus.status === "ok"
                      ? "text-green-500"
                      : healthStatus.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {healthStatus.status === "ok" ? (
                    <Activity className="h-5 w-5" />
                  ) : healthStatus.status === "error" ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{healthStatus.message}</p>
                  {healthStatus.url && <p className="text-xs text-muted-foreground mt-1">Server: {healthStatus.url}</p>}
                  {healthStatus.status === "ok" && healthStatus.streamCount !== undefined && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Available streams: {healthStatus.streamCount}</p>
                      {healthStatus.streams && healthStatus.streams.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {healthStatus.streams.map((stream) => (
                            <Badge key={stream} variant="secondary" className="text-xs">
                              {stream}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {healthStatus.status === "error" && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>請確認：</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>go2rtc 是否正在運行</li>
                        <li>.env.local 中的 GO2RTC_API_URL 是否正確</li>
                        <li>預設值：http://localhost:1984</li>
                      </ul>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setHealthStatus({ status: null, message: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            {cameras.map((camera) => (
              <Card key={camera.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{camera.name}</h3>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {camera.rtspUrl && <p>RTSP: {camera.rtspUrl}</p>}
                        <p>Detecting: {camera.detectObjects?.join(", ") || "No objects configured"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setExpandedCamera(expandedCamera === camera.id ? null : camera.id)
                        }}
                      >
                        {expandedCamera === camera.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <Settings className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDeleteCamera(camera.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {expandedCamera === camera.id && (
                    <div className="mt-4 space-y-6 p-6 border-t bg-muted/20">
                      {console.log("[v0] Rendering expanded camera:", {
                        cameraId: camera.id,
                        virtualFencesCount: camera.virtualFences?.length || 0,
                        virtualFences: camera.virtualFences,
                        selectedModel: selectedModel[camera.id],
                      })}

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-foreground">Live Stream</h4>
                          <div className="flex items-center gap-2">
                            <Circle
                              className={`h-2 w-2 ${
                                videoError[camera.id]
                                  ? "fill-destructive text-destructive"
                                  : videoConnected[camera.id]
                                    ? "fill-primary text-primary animate-pulse"
                                    : "fill-muted-foreground text-muted-foreground opacity-50"
                              }`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {videoError[camera.id] ? "ERROR" : videoConnected[camera.id] ? "LIVE" : "CONNECTING..."}
                            </span>
                          </div>
                        </div>
                        <div className="relative w-full max-w-2xl">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full rounded-lg border border-border bg-secondary"
                          />

                          {videoError[camera.id] && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/95 rounded-lg">
                              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                              <p className="text-sm text-center text-foreground max-w-[400px] px-4">
                                {videoError[camera.id]}
                              </p>
                              <p className="text-xs text-center text-muted-foreground mt-2">
                                Stream: {camera.streamUrl}
                              </p>
                            </div>
                          )}

                          {videoLoading[camera.id] && !videoError[camera.id] && (
                            <div className="absolute inset-0 flex items-center justify-center bg-secondary/95 rounded-lg">
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <p className="text-sm text-muted-foreground">Loading stream...</p>
                              </div>
                            </div>
                          )}

                          {editingFence?.cameraId === camera.id && (
                            <canvas
                              ref={canvasRef}
                              width={640}
                              height={360}
                              className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                              onMouseDown={handleCanvasMouseDown}
                              onMouseMove={handleCanvasMouseMove}
                              onMouseUp={handleCanvasMouseUp}
                              onMouseLeave={handleCanvasMouseUp}
                            />
                          )}
                        </div>
                        {editingFence?.cameraId === camera.id && (
                          <p className="text-xs text-muted-foreground mt-2">
                            拖動圓點來調整電子圍籬範圍，完成後點擊「Done」保存座標
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Detection Model (偵測模型)</Label>
                        <Select
                          value={selectedModel[camera.id] || ""}
                          onValueChange={(value) => handleModelChange(camera.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            {models.map((model) => (
                              <SelectItem key={model.name} value={model.name}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">選擇偵測模型後，電子圍籬將使用該模型的物件類別</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <Label className="text-base font-semibold">Virtual Fences (電子圍籬)</Label>
                          <Button
                            size="sm"
                            onClick={() => addVirtualFence(camera.id)}
                            disabled={!selectedModel[camera.id]}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Fence
                          </Button>
                        </div>

                        {console.log(
                          "[v0] About to render fences for camera:",
                          camera.id,
                          "count:",
                          camera.virtualFences?.length || 0,
                        )}
                        {camera.virtualFences?.map((fence, fenceIndex) => (
                          <Card key={fenceIndex} className="p-4 bg-muted/50">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={fence.enabled}
                                  onCheckedChange={() => toggleFenceEnabled(camera.id, fenceIndex)}
                                />
                                <div>
                                  <p className="font-medium text-sm">{fence.name}</p>
                                  <p className="text-xs text-muted-foreground">{fence.points.length} points</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditZoneClick(camera.id, fenceIndex)}
                                >
                                  {editingFence?.cameraId === camera.id && editingFence?.fenceIndex === fenceIndex
                                    ? "Done"
                                    : "Edit Zone"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeVirtualFence(camera.id, fenceIndex)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs text-muted-foreground mb-2 block">
                                Detect Objects (偵測類別):
                              </Label>
                              <div className="grid grid-cols-3 gap-2">
                                {getAvailableClasses(camera.id).map((obj) => (
                                  <div key={obj} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`${camera.id}-${fenceIndex}-${obj}`}
                                      checked={fence.detectObjects.includes(obj)}
                                      onCheckedChange={(checked) => {
                                        const newObjects = checked
                                          ? [...fence.detectObjects, obj]
                                          : fence.detectObjects.filter((o) => o !== obj)
                                        updateFenceObjects(camera.id, fenceIndex, newObjects)
                                      }}
                                    />
                                    <label
                                      htmlFor={`${camera.id}-${fenceIndex}-${obj}`}
                                      className="text-sm cursor-pointer"
                                    >
                                      {obj}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {(!camera.virtualFences || camera.virtualFences.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No electronic fences configured. Click &quot;Add Fence&quot; to create one.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
