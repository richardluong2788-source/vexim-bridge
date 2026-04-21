import { NotificationBell } from "@/components/notifications/notification-bell"
import { getNotificationsSnapshot } from "@/app/notifications/actions"

/**
 * Shared top bar for the admin + client portals. Kept intentionally minimal —
 * it just hosts the notification bell for now, but is the natural place to
 * grow a search box, breadcrumb, or user menu later.
 *
 * Rendered as a server component so the initial snapshot ships with the HTML
 * (no client-side fetch on first paint).
 */
export async function AppTopbar() {
  const snapshot = await getNotificationsSnapshot()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-2 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <NotificationBell
        initialUnreadCount={snapshot.unreadCount}
        initialRecent={snapshot.recent}
      />
    </header>
  )
}
