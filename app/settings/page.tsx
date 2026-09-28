import { redirect } from "next/navigation"

/**
 * `/settings` is a shell with two tabs; land on the personal profile page.
 * Deep links to /settings/notifications (notification bell, legal pages,
 * unsubscribe emails) keep working. The sidebars land here so "Cài đặt"
 * opens the personal profile first.
 */
export default function SettingsIndexPage() {
  redirect("/settings/profile")
}
