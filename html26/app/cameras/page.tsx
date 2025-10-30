"use client"

import type React from "react"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Video, Settings, Trash2, RefreshCw, AlertCircle, ChevronUp, Plus, X, Download, Upload } from "lucide-react"
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
import type { CameraConfig, VirtualFence } from "@/config/cameras"
import { Checkbox } from "@/components/ui/checkbox"

const DETECTION_OBJECTS = [
  "person",
  "car",
  "dog",
  "cat",
  "bicycle",
  "motorcycle",
  "bird",
  "package",
  "animal",
  "truck",
  "bus",
]

export default function CamerasPage() {
  const [open, setOpen] = useState(false)
  const [cameraName, setCameraName] = useState("")
  const [cameraUrl, setCameraUrl] = useState("")
  const { cameras, updateCameras, isLoading } = useCameraConfig()
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null)
  const [editingFence, setEditingFence] = useState<{ cameraId: string; fenceIndex: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportConfig = () => {
    const configData = {
      cameras,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `frigate-config-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsed = JSON.parse(content)
        if (parsed.cameras && Array.isArray(parsed.cameras)) {
          updateCameras(parsed.cameras)
          console.log("[v0] Imported camera config from file")
        } else {
          alert("Invalid configuration file format")
        }
      } catch (error) {
        console.error("[v0] Failed to import config:", error)
        alert("Failed to import configuration file")
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleAddCamera = () => {
    const newCamera: CameraConfig = {
      id: `cam${cameras.length + 1}`,
      name: cameraName,
      location: "New Location",
      streamUrl: cameraUrl,
      enabled: true,
      resolution: "1920x1080",
      fps: 30,
      detectObjects: ["person"],
      recordingEnabled: true,
      snapshotsEnabled: true,
      motionDetection: true,
      minConfidence: 70,
    }

    updateCameras([...cameras, newCamera])
    setOpen(false)
    setCameraName("")
    setCameraUrl("")
  }

  const handleDeleteCamera = (cameraId: string) => {
    if (confirm("Are you sure you want to delete this camera?")) {
      const updatedCameras = cameras.filter((cam) => cam.id !== cameraId)
      updateCameras(updatedCameras)
      // Close settings panel if the deleted camera was expanded
      if (expandedCamera === cameraId) {
        setExpandedCamera(null)
      }
    }
  }

  const toggleCameraSettings = (cameraId: string) => {
    setExpandedCamera(expandedCamera === cameraId ? null : cameraId)
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

  useEffect(() => {
    if (!canvasRef.current || !editingFence) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const camera = cameras.find((c) => c.id === editingFence.cameraId)
    const fence = camera?.virtualFences?.[editingFence.fenceIndex]
    if (!fence) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw fence polygon
    ctx.beginPath()
    fence.points.forEach((point, i) => {
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
    ctx.fillStyle = fence.enabled ? "rgba(59, 130, 246, 0.1)" : "rgba(107, 114, 128, 0.1)"
    ctx.fill()

    // Draw points
    fence.points.forEach((point) => {
      const x = point.x * canvas.width
      const y = point.y * canvas.height
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = fence.enabled ? "#3b82f6" : "#6b7280"
      ctx.fill()
    })
  }, [editingFence, cameras])

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
              <input ref={fileInputRef} type="file" accept=".json" onChange={importConfig} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button variant="outline" onClick={exportConfig}>
                <Download className="mr-2 h-4 w-4" />
                Export
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
                    <DialogDescription>
                      Enter the camera name and IP camera stream URL to add a new camera to your system.
                    </DialogDescription>
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
                      <Label htmlFor="url">IP Camera URL</Label>
                      <Input
                        id="url"
                        placeholder="e.g., rtsp://192.168.1.100:554/stream"
                        value={cameraUrl}
                        onChange={(e) => setCameraUrl(e.target.value)}
                      />
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

          <div className="grid gap-4">
            {cameras.map((camera) => (
              <Card key={camera.id} className="p-6 bg-card border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-32 w-48 bg-muted rounded-lg flex items-center justify-center">
                      {camera.enabled ? (
                        <img
                          src={`/security-camera-view.png?height=128&width=192&query=security camera view ${camera.name}`}
                          alt={camera.name}
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{camera.name}</h3>
                        <Badge variant={camera.enabled ? "default" : "destructive"}>
                          {camera.enabled ? "online" : "offline"}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Location: {camera.location}</p>
                        <p>Resolution: {camera.resolution}</p>
                        <p>FPS: {camera.fps}</p>
                        <p>Stream: {camera.streamUrl}</p>
                        <p>Detecting: {camera.detectObjects.join(", ")}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => toggleCameraSettings(camera.id)}>
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
                  <div className="mt-6 pt-6 border-t border-border space-y-6">
                    {/* Snapshot Preview */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Current Snapshot</h4>
                      <div className="relative w-full max-w-2xl">
                        <img
                          src={`/security-camera-view.png?height=360&width=640&query=security camera snapshot ${camera.name}`}
                          alt={`${camera.name} snapshot`}
                          className="w-full rounded-lg border border-border"
                        />
                        {editingFence?.cameraId === camera.id && (
                          <canvas
                            ref={canvasRef}
                            width={640}
                            height={360}
                            className="absolute top-0 left-0 w-full h-full"
                          />
                        )}
                      </div>
                    </div>

                    {/* Virtual Fences Configuration */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground">Electronic Fences (電子圍籬)</h4>
                        <Button size="sm" variant="outline" onClick={() => addVirtualFence(camera.id)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Fence
                        </Button>
                      </div>

                      <div className="space-y-4">
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
                                  onClick={() =>
                                    setEditingFence(
                                      editingFence?.cameraId === camera.id && editingFence?.fenceIndex === fenceIndex
                                        ? null
                                        : { cameraId: camera.id, fenceIndex },
                                    )
                                  }
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

                            {/* Detection Objects Selection */}
                            <div>
                              <Label className="text-xs text-muted-foreground mb-2 block">
                                Detect Objects (偵測類別):
                              </Label>
                              <div className="grid grid-cols-3 gap-2">
                                {DETECTION_OBJECTS.map((obj) => (
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

                        {(!camera.virtualFences || camera.virtualFences.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No electronic fences configured. Click "Add Fence" to create one.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
