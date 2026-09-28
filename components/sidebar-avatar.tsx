"use client"

import { useState } from "react"

interface SidebarAvatarProps {
  name: string
  avatarUrl?: string | null
}

/** Footer avatar shared by the admin and client sidebars. Falls back to an initial if the photo fails to load. */
export function SidebarAvatar({ name, avatarUrl }: SidebarAvatarProps) {
  const [broken, setBroken] = useState(false)
  const initial = (name.trim().charAt(0) || "?").toUpperCase()

  if (avatarUrl && !broken) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
      {initial}
    </div>
  )
}
