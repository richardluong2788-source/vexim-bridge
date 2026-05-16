"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

/**
 * Server actions for the client portal — submit + close own SLA requests.
 *
 * SECURITY: every action explicitly resolves auth.uid() and force-sets
 * client_id from it (never from the form). Backdated `received_at` is
 * forbidden for the client; only staff use logManualClientRequest.
 */

interface ActionResult<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

const SUBMIT_SCHEMA = z.object({
  subject: z.string().min(2, "Tiêu đề tối thiểu 2 ký tự").max(200),
  body: z.string().max(4000).optional(),
  priority: z
    .enum(["low", "normal", "high", "urgent"])
    .default("normal")
    .optional(),
})

export async function submitClientRequest(
  input: z.input<typeof SUBMIT_SCHEMA>,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "unauthenticated" }

  const parsed = SUBMIT_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }

  // Use admin client to bypass RLS for the insert — we're already
  // pinning client_id to auth.uid() so the row is guaranteed to belong
  // to the caller.
  const admin = createAdminClient()

  // Defensive role check: ONLY clients submit through this surface.
  // Staff should use logManualClientRequest in /admin/sla/actions.ts.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string | null }>()
  if (profile?.role !== "client") {
    return { ok: false, error: "Chỉ client portal mới gửi qua endpoint này" }
  }

  const { data, error } = await admin
    .from("client_requests" as never)
    .insert({
      client_id: user.id,
      channel: "portal",
      subject: parsed.data.subject.trim(),
      body: parsed.data.body?.trim() || null,
      priority: parsed.data.priority ?? "normal",
      status: "open",
      logged_via_channel: false,
    } as never)
    .select("id")
    .single<{ id: string }>()

  if (error) return { ok: false, error: error.message }

  // Notify Account Manager and all staff with SLA_NOTIFY permission
  // Get the client's account manager
  const { data: clientData } = await admin
    .from("profiles")
    .select("account_manager_id")
    .eq("id", user.id)
    .single<{ account_manager_id: string | null }>()

  // Get all staff with SLA_NOTIFY permission (admin, staff with perm)
  const { data: staffList } = await admin
    .from("profiles")
    .select("id, email")
    .in("role", ["admin", "super_admin", "staff"])

  // Build recipient list: account manager + all staff
  const recipientIds = new Set<string>()
  if (clientData?.account_manager_id) {
    recipientIds.add(clientData.account_manager_id)
  }
  if (staffList) {
    staffList.forEach((s) => recipientIds.add(s.id))
  }

  // Send notification to each recipient
  for (const recipientId of recipientIds) {
    dispatchNotification({
      userId: recipientId,
      category: "action_required",
      linkPath: `/admin/sla?request_id=${data.id}`,
      dedupKey: `client_request_new:${data.id}`,
      title: {
        vi: `Yêu cầu mới từ ${user.email}`,
        en: `New request from ${user.email}`,
      },
      body: {
        vi: parsed.data.subject,
        en: parsed.data.subject,
      },
      ctaLabel: {
        vi: "Xem yêu cầu",
        en: "View request",
      },
    }).catch((err) => {
      console.error("[sla] notification dispatch failed", err)
    })
  }

  revalidatePath("/client/sla")
  return { ok: true, data }
}

const CANCEL_SCHEMA = z.object({
  request_id: z.string().uuid(),
})

/**
 * Lets the client mark their own request as closed (e.g. they sorted
 * it out via another channel). Cannot reopen — same as admin resolve.
 */
export async function cancelClientRequest(
  input: z.input<typeof CANCEL_SCHEMA>,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "unauthenticated" }

  const parsed = CANCEL_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("client_requests" as never)
    .update({
      status: "closed",
      resolved_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.request_id)
    .eq("client_id", user.id) // CRITICAL: ownership check
    .in("status", ["open", "in_progress"])

  if (error) return { ok: false, error: error.message }
  revalidatePath("/client/sla")
  return { ok: true }
}
