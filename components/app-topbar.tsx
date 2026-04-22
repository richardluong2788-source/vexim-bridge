import { NotificationBell } from "@/components/notifications/notification-bell"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { getNotificationsSnapshot } from "@/app/notifications/actions"

/**
 * Shared top bar for the admin + client portals. Hosts the language
 * switcher and the notification bell on the right side — this is the
 * most visible spot in the shell, so both sidebar footers no longer
 * duplicate the language control.
 *
 * Rendered as a server component so the initial notification snapshot
 * ships with the HTML (no client-side fetch on first paint).
 */
export async function AppTopbar() {
  const snapshot = await getNotificationsSnapshot()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-1 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <LanguageSwitcher compact />
      <NotificationBell
        initialUnreadCount={snapshot.unreadCount}
        initialRecent={snapshot.recent}
      />
    </header>
  )
}
