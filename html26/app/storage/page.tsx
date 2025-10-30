import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { Card } from "@/components/ui/card"
import { HardDrive, Database, Film, AlertTriangle } from "lucide-react"

export default function StoragePage() {
  const storageData = {
    total: 500,
    used: 342,
    recordings: 280,
    events: 45,
    snapshots: 17,
  }

  const usedPercentage = (storageData.used / storageData.total) * 100

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Storage</h1>
            <p className="text-sm text-muted-foreground">Monitor storage usage and capacity</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <HardDrive className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Storage</p>
                  <p className="text-2xl font-bold text-foreground">{storageData.total} GB</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Used Storage</p>
                  <p className="text-2xl font-bold text-foreground">{storageData.used} GB</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Film className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recordings</p>
                  <p className="text-2xl font-bold text-foreground">{storageData.recordings} GB</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Free Space</p>
                  <p className="text-2xl font-bold text-foreground">{storageData.total - storageData.used} GB</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6 bg-card border-border mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Storage Usage</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Overall Usage</span>
                  <span className="text-foreground font-medium">{usedPercentage.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${usedPercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Recordings</span>
                  <span className="text-foreground font-medium">{storageData.recordings} GB</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(storageData.recordings / storageData.total) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Events</span>
                  <span className="text-foreground font-medium">{storageData.events} GB</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(storageData.events / storageData.total) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Snapshots</span>
                  <span className="text-foreground font-medium">{storageData.snapshots} GB</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 rounded-full transition-all"
                    style={{ width: `${(storageData.snapshots / storageData.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Retention Policy</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recordings Retention</span>
                <span className="text-foreground">7 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Events Retention</span>
                <span className="text-foreground">30 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Snapshots Retention</span>
                <span className="text-foreground">14 days</span>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  )
}
