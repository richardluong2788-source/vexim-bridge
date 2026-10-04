"use client"

import { OPEN_COOKIE_PREFERENCES_EVENT } from "@/lib/analytics/meta-pixel"

export function CookiePreferencesButton({
  label = "Cài đặt cookie",
  className = "",
}: {
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))}
    >
      {label}
    </button>
  )
}
