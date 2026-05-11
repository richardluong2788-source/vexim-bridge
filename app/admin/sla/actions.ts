"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import {
  buildEvalContext,
  evaluateClientForMonth,
} from "@/lib/sla/evaluator"

/**
 * Server actions for the admin SLA pages.
 * Every action gates on a capability via lib/auth/guard.
 */

const PERIOD_MONTH_SCHEMA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "period_month must be YYYY-MM-DD")

interface ActionResult<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

// ---------------------------------------------------------------------
// Trigger / re-run an SLA evaluation for a given month.
// ---------------------------------------------------------------------
export async function triggerSlaEvaluation(input: {
  periodMonth: string
  force?: boolean
}): Promise<ActionResult<{ violations_inserted: number; scanned_clients: number }>> {
  const guard = await requireCap(CAPS.SLA_RUN_TRIGGER)
  if (!guard.ok) return { ok: false, error: guard.error }

  const parsed = PERIOD_MONTH_SCHEMA.safeParse(input.periodMonth)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid month" }
  }

  const admin = guard.admin
  // If forcing, drop the prior run row so we can re-claim.
  if (input.force) {
    await admin
      .from("sla_evaluation_runs" as never)
      .delete()
      .eq("period_month", parsed.data)
  }

  // Claim the run slot.
  const { error: claimErr } = await admin
    .from("sla_evaluation_runs" as never)
    .insert({
      period_month: parsed.data,
      status: "running",
      triggered_by: `manual:${guard.userId}`,
    } as never)
  if (claimErr) {
    if ((claimErr as { code?: string }).code === "23505") {
      return {
        ok: false,
        error:
          "Một lần đánh giá đang chạy cho tháng này. Bật 'Force' để override.",
      }
    }
    return { ok: false, error: claimErr.message }
  }

  const anchor = new Date(`${parsed.data}T00:00:00Z`)
  const ctx = await buildEvalContext(admin, anchor)

  const { data: clients } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")

  let totalNew = 0
  for (const c of clients ?? []) {
    const { newViolations } = await evaluateClientForMonth(ctx, c.id)
    totalNew += newViolations
  }

  await admin
    .from("sla_evaluation_runs" as never)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      scanned_clients: clients?.length ?? 0,
      violations_inserted: totalNew,
    } as never)
    .eq("period_month", parsed.data)

  revalidatePath("/admin/sla")
  return {
    ok: true,
    data: {
      violations_inserted: totalNew,
      scanned_clients: clients?.length ?? 0,
    },
  }
}

// ---------------------------------------------------------------------
// Holiday calendar mgmt
// ---------------------------------------------------------------------
const HOLIDAY_SCHEMA = z.object({
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD"),
  label: z.string().min(2, "Tên ngày nghỉ tối thiểu 2 ký tự").max(80),
})

export async function addSlaHoliday(input: {
  holiday_date: string
  label: string
}): Promise<ActionResult> {
  const guard = await requireCap(CAPS.SLA_HOLIDAY_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const parsed = HOLIDAY_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }
  const { error } = await guard.admin
    .from("sla_holidays" as never)
    .upsert(
      {
        holiday_date: parsed.data.holiday_date,
        label: parsed.data.label,
        created_by: guard.userId,
      } as never,
      { onConflict: "holiday_date" },
    )
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/sla/holidays")
  return { ok: true }
}

export async function removeSlaHoliday(holidayDate: string): Promise<ActionResult> {
  const guard = await requireCap(CAPS.SLA_HOLIDAY_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
    return { ok: false, error: "Định dạng ngày không hợp lệ" }
  }
  const { error } = await guard.admin
    .from("sla_holidays" as never)
    .delete()
    .eq("holiday_date", holidayDate)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/sla/holidays")
  return { ok: true }
}

// ---------------------------------------------------------------------
// Target updates (global defaults)
// ---------------------------------------------------------------------
const TARGET_UPDATE_SCHEMA = z.object({
  id: z.string().uuid(),
  target_value: z.coerce.number().min(0).max(10_000),
  weight: z.coerce.number().min(0).max(1),
  notes: z.string().max(500).nullable().optional(),
})

export async function updateSlaTarget(
  input: z.input<typeof TARGET_UPDATE_SCHEMA>,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.SLA_TARGET_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const parsed = TARGET_UPDATE_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }
  const { error } = await guard.admin
    .from("sla_targets" as never)
    .update({
      target_value: parsed.data.target_value,
      weight: parsed.data.weight,
      notes: parsed.data.notes ?? null,
    } as never)
    .eq("id", parsed.data.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/sla")
  revalidatePath("/admin/sla/targets")
  return { ok: true }
}

// ---------------------------------------------------------------------
// Client request management — admin response logging
// ---------------------------------------------------------------------
const RESPOND_SCHEMA = z.object({
  request_id: z.string().uuid(),
  note: z.string().max(2000).optional(),
})

export async function respondToClientRequest(
  input: z.input<typeof RESPOND_SCHEMA>,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.CLIENT_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const parsed = RESPOND_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }

  const nowIso = new Date().toISOString()
  const { error } = await guard.admin
    .from("client_requests" as never)
    .update({
      first_response_at: nowIso,
      first_response_by: guard.userId,
      first_response_note: parsed.data.note ?? null,
      status: "in_progress",
    } as never)
    .eq("id", parsed.data.request_id)
    .is("first_response_at", null)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/sla")
  return { ok: true }
}

const RESOLVE_SCHEMA = z.object({
  request_id: z.string().uuid(),
})

export async function resolveClientRequest(
  input: z.input<typeof RESOLVE_SCHEMA>,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.CLIENT_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const parsed = RESOLVE_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }
  const { error } = await guard.admin
    .from("client_requests" as never)
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.request_id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/sla")
  return { ok: true }
}

// Manual log (e.g. recorded from Zalo / phone). Allows backdated received_at
// up to 30 days in the past.
const MANUAL_LOG_SCHEMA = z.object({
  client_id: z.string().uuid(),
  channel: z.enum(["email", "zalo", "phone", "whatsapp", "other"]),
  subject: z.string().min(2).max(200),
  body: z.string().max(4000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  received_at: z.string().datetime().optional(),
})

export async function logManualClientRequest(
  input: z.input<typeof MANUAL_LOG_SCHEMA>,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireCap(CAPS.CLIENT_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }
  const parsed = MANUAL_LOG_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }

  // Cap backdating to 30 days. CHECK constraint on the table also enforces
  // received_at <= now() + 5min, so only past values are allowed.
  let receivedAt = parsed.data.received_at ?? new Date().toISOString()
  const earliest = new Date()
  earliest.setUTCDate(earliest.getUTCDate() - 30)
  if (new Date(receivedAt) < earliest) {
    receivedAt = earliest.toISOString()
  }

  const { data, error } = await guard.admin
    .from("client_requests" as never)
    .insert({
      client_id: parsed.data.client_id,
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body: parsed.data.body ?? null,
      priority: parsed.data.priority,
      received_at: receivedAt,
      logged_by: guard.userId,
      logged_via_channel: true,
      status: "open",
    } as never)
    .select("id")
    .single<{ id: string }>()
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/sla")
  return { ok: true, data: data ?? { id: "" } }
}
