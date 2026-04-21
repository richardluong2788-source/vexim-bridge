"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/components/i18n/language-provider"
import type { Notification } from "@/lib/supabase/types"
import {
  getNotificationsSnapshot,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions"

interface NotificationBellProps {
  initialUnreadCount: number
  initialRecent: Notification[]
}

/**
 * Bell icon + dropdown. Keeps a local copy of the latest snapshot so the UI
 * feels instant, and refreshes from the server:
 *   - on first open
 *   - after mark-as-read actions (optimistic)
 */
export function NotificationBell({
  initialUnreadCount,
  initialRecent,
}: NotificationBellProps) {
  const { t, locale } = useTranslation()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(initialUnreadCount)
  const [items, setItems] = useState<Notification[]>(initialRecent)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [, startTransition] = useTransition()

  async function refresh() {
    const snap = await getNotificationsSnapshot()
    setUnread(snap.unreadCount)
    setItems(snap.recent)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Lazy refresh on first open so the bell badge stays accurate without
    // polling. Subsequent opens reuse local state unless user explicitly
    // triggers a mutation below.
    if (next && !hasLoadedOnce) {
      setHasLoadedOnce(true)
      startTransition(refresh)
    }
  }

  function handleMarkOne(id: string) {
    // Optimistic: fade the row into "read" state immediately.
    setItems((prev) =>
      prev.map((n) =>
        n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    )
    setUnread((c) => Math.max(0, c - 1))
    startTransition(async () => {
      await markNotificationRead(id)
    })
  }

  function handleMarkAll() {
    if (unread === 0) return
    const nowIso = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso })))
    setUnread(0)
    startTransition(async () => {
      await markAllNotificationsRead()
    })
  }

  function handleItemClick(n: Notification) {
    if (!n.read_at) handleMarkOne(n.id)
    setOpen(false)
    if (n.link_path) router.push(n.link_path)
  }

  const displayCount = unread > 99 ? "99+" : unread.toString()

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.notifications.title}
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            >
              {displayCount}
            </span>
          )}
          <span className="sr-only">
            {unread > 0 ? `${unread} unread notifications` : "No unread notifications"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t.notifications.title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={unread === 0}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t.notifications.markAllRead}
            </Button>
          </div>
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t.notifications.empty}
            </p>
            <p className="text-xs text-muted-foreground text-pretty">
              {t.notifications.emptyDesc}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="flex flex-col">
              {items.map((n) => (
                <li key={n.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40",
                      !n.read_at && "bg-accent/20",
                    )}
                  >
                    <CategoryDot category={n.category} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug text-foreground truncate",
                            !n.read_at && "font-semibold",
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.read_at && (
                          <span className="ml-auto shrink-0 inline-flex items-center rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                            {t.notifications.newBadge}
                          </span>
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 text-pretty">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        <CategoryLabel category={n.category} />
                        <span aria-hidden="true" className="px-1">·</span>
                        {formatRelative(n.created_at, locale, t.notifications.timeAgo)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="border-t border-border px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href="/settings/notifications" onClick={() => setOpen(false)}>
              <Settings className="h-3.5 w-3.5" />
              {t.notifications.viewAll}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// -----------------------------------------------------------------------------
// Category presentation
// -----------------------------------------------------------------------------

function CategoryDot({ category }: { category: Notification["category"] }) {
  const color: Record<Notification["category"], string> = {
    action_required: "bg-destructive",
    status_update: "bg-chart-1",
    deal_closed: "bg-chart-4",
    new_assignment: "bg-primary",
    system: "bg-muted-foreground",
  }
  return (
    <span
      aria-hidden="true"
      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", color[category])}
    />
  )
}

function CategoryLabel({ category }: { category: Notification["category"] }) {
  const { t } = useTranslation()
  return <span>{t.notifications.categories[category]}</span>
}

// -----------------------------------------------------------------------------
// Relative-time formatter. Kept local so it honours the active locale without
// pulling in a date library. Falls back to localized short date when older
// than a week.
// -----------------------------------------------------------------------------

function formatRelative(
  iso: string,
  locale: string,
  labels: {
    now: string
    minute: string
    hour: string
    day: string
    longerThanAWeek: string
  },
): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = Math.max(0, now - then)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return labels.now
  if (minutes < 60) return labels.minute.replace("{n}", String(minutes))
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return labels.hour.replace("{n}", String(hours))
  const days = Math.floor(hours / 24)
  if (days < 7) return labels.day.replace("{n}", String(days))
  const formatter = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
  })
  return labels.longerThanAWeek.replace("{date}", formatter.format(new Date(iso)))
}
