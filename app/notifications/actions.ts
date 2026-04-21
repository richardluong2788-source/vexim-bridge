"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Notification } from "@/lib/supabase/types"

/**
 * Server actions that power the notification bell dropdown. RLS ensures a
 * user can only ever see/mutate their own rows, so we intentionally use the
 * regular (auth-scoped) client — no service role needed.
 */

export interface NotificationsSnapshot {
  unreadCount: number
  recent: Notification[]
}

/**
 * Fetch the user's most recent notifications plus the current unread count.
 * Used both for the initial SSR payload and for refreshing the dropdown.
 */
export async function getNotificationsSnapshot(
  limit = 15,
): Promise<NotificationsSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { unreadCount: 0, recent: [] }

  // Fire the two reads in parallel; the count head-query is cheap because it
  // is served by the partial index `idx_notifications_user_unread`.
  const [recentRes, countRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ])

  return {
    recent: recentRes.data ?? [],
    unreadCount: countRes.count ?? 0,
  }
}

/**
 * Mark a single notification read. Silently no-ops if the id does not belong
 * to the caller (RLS will just filter the update away).
 */
export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  if (!id) return { ok: false }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("read_at", null)

  if (error) {
    console.error("[v0] markNotificationRead error", error.message)
    return { ok: false }
  }

  revalidatePath("/admin")
  revalidatePath("/client")
  return { ok: true }
}

/** Mark every unread notification for the current user as read. */
export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)

  if (error) {
    console.error("[v0] markAllNotificationsRead error", error.message)
    return { ok: false }
  }

  revalidatePath("/admin")
  revalidatePath("/client")
  return { ok: true }
}
