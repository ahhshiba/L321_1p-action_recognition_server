import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, Bell, Shield, Database, Cpu, Save } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure your Frigate system</p>
          </div>

          <div className="space-y-6 max-w-4xl">
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">General Settings</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">System Name</p>
                    <p className="text-xs text-muted-foreground">Customize your system name</p>
                  </div>
                  <input
                    type="text"
                    defaultValue="Frigate NVR"
                    className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Timezone</p>
                    <p className="text-xs text-muted-foreground">Set your local timezone</p>
                  </div>
                  <select className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground">
                    <option>UTC</option>
                    <option>America/New_York</option>
                    <option>Europe/London</option>
                    <option>Asia/Tokyo</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Person Detection</p>
                    <p className="text-xs text-muted-foreground">Get notified when a person is detected</p>
                  </div>
                  <Badge variant="default">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Vehicle Detection</p>
                    <p className="text-xs text-muted-foreground">Get notified when a vehicle is detected</p>
                  </div>
                  <Badge variant="outline">Disabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">System Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified about system issues</p>
                  </div>
                  <Badge variant="default">Enabled</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <Cpu className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Detection Settings</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Detection FPS</p>
                    <p className="text-xs text-muted-foreground">Frames per second for object detection</p>
                  </div>
                  <input
                    type="number"
                    defaultValue="5"
                    className="w-20 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Confidence Threshold</p>
                    <p className="text-xs text-muted-foreground">Minimum confidence for detections (0-1)</p>
                  </div>
                  <input
                    type="number"
                    defaultValue="0.7"
                    step="0.1"
                    min="0"
                    max="1"
                    className="w-20 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Storage Settings</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Recording Retention</p>
                    <p className="text-xs text-muted-foreground">Days to keep recordings</p>
                  </div>
                  <input
                    type="number"
                    defaultValue="7"
                    className="w-20 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Event Retention</p>
                    <p className="text-xs text-muted-foreground">Days to keep event clips</p>
                  </div>
                  <input
                    type="number"
                    defaultValue="30"
                    className="w-20 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Security</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Authentication</p>
                    <p className="text-xs text-muted-foreground">Require login to access system</p>
                  </div>
                  <Badge variant="default">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">HTTPS</p>
                    <p className="text-xs text-muted-foreground">Use secure connection</p>
                  </div>
                  <Badge variant="default">Enabled</Badge>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="outline">Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
