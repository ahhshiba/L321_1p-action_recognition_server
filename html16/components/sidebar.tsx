"use client"

import { Video, Activity, Clock, Settings, Grid3x3, HardDrive } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { icon: Grid3x3, label: "Dashboard", href: "/" },
  { icon: Video, label: "Cameras", href: "/cameras" },
  { icon: Activity, label: "Events", href: "/events" },
  { icon: Clock, label: "Recordings", href: "/recordings" },
  { icon: HardDrive, label: "Storage", href: "/storage" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-16 flex-col items-center gap-4 border-r border-border bg-sidebar py-4">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <Video className="h-6 w-6 text-primary-foreground" />
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              pathname === item.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </Link>
        ))}
      </nav>
    </aside>
  )
}
