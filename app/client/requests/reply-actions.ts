"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"

interface ActionResult {
  ok: boolean
  error?: string
}

const REPLY_SCHEMA = z.object({
  request_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

export async function addReplyToRequest(
  input: z.input<typeof REPLY_SCHEMA>,
): Promise<ActionResult> {
  // For now, clients can use their own session without requiring CAPS
  // In production, you might want to add proper auth check
  const guard = await requireCap(CAPS.CLIENT_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }

  const parsed = REPLY_SCHEMA.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid" }
  }

  // Verify the request exists and belongs to the user
  const { data: request } = await guard.admin
    .from("client_requests" as never)
    .select("id, client_id, status")
    .eq("id", parsed.data.request_id)
    .single<{ id: string; client_id: string; status: string }>()

  if (!request) return { ok: false, error: "Request not found" }

  // Verify ownership for clients
  if (guard.userId !== request.client_id) {
    return { ok: false, error: "You cannot reply to other clients' requests" }
  }

  // Add the reply
  const { error: replyError } = await guard.admin
    .from("client_request_replies" as never)
    .insert({
      client_request_id: parsed.data.request_id,
      sender_id: guard.userId,
      sender_role: "client",
      body: parsed.data.body,
    } as never)
  if (replyError) {
    return { ok: false, error: `Failed to save reply: ${replyError.message}` }
  }

  revalidatePath("/client/sla")
  return { ok: true }
}

export async function fetchRequestReplies(requestId: string) {
  const guard = await requireCap(CAPS.CLIENT_VIEW)
  if (!guard.ok) return { ok: false, error: guard.error }

  const { data: replies, error } = await guard.admin
    .from("client_request_replies" as never)
    .select(
      "id, client_request_id, sender_id, sender_role, body, created_at",
    )
    .eq("client_request_id", requestId)
    .order("created_at", { ascending: true })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, data: replies }
}
