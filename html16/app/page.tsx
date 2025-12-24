import { CameraGrid } from "@/components/camera-grid"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"

export default function Home() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-4">
          <CameraGrid />
        </main>
      </div>
    </div>
  )
}
