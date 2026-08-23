"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendMail } from "@/lib/mail"
import { buildPersonalizedSender, getSenderEmail } from "@/lib/email/mailer"
import { normaliseRole, can, CAPS } from "@/lib/auth/permissions"
import { ownershipScopeFor, assertOpportunityOwned } from "@/lib/auth/scope"

export interface SendClientUpdateEmailInput {
  opportunityId: string
  clientId: string
  to: string
  subject: string
  body: string
}

export type SendClientUpdateEmailResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Send a manual update email from AE to the client (Vietnamese exporter).
 *
 * Security:
 *   - Caller must be authenticated AND hold CAPS.CLIENT_WRITE (account_executive,
 *     staff, admin, super_admin — see lib/auth/permissions.ts).
 *   - Ownership gate: AE can only email clients on opportunities they own.
 */
export async function sendClientUpdateEmail(
  input: SendClientUpdateEmailInput,
): Promise<SendClientUpdateEmailResult> {
  // Validate input
  if (!input.opportunityId || !input.clientId || !input.to || !input.subject || !input.body) {
    return { ok: false, error: "Thiếu thông tin bắt buộc" }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(input.to)) {
    return { ok: false, error: "Email không hợp lệ" }
  }

  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Chưa đăng nhập" }

  // Role check — use the shared capability map (CAPS.CLIENT_WRITE) instead
  // of a hardcoded role list, so this stays in sync with the rest of the
  // RBAC system. account_executive, staff, admin, and super_admin all hold
  // CLIENT_WRITE; finance/lead_researcher do not (by design — see
  // lib/auth/permissions.ts).
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, full_name, work_email")
    .eq("id", user.id)
    .single()

  const role = normaliseRole(callerProfile?.role)
  if (!role || !can(role, CAPS.CLIENT_WRITE)) {
    return { ok: false, error: "Không có quyền" }
  }

  const admin = createAdminClient()

  // Ownership gate: AE can only send emails for opportunities they own
  const scope = ownershipScopeFor(role, user.id)
  const own = await assertOpportunityOwned(scope, admin, input.opportunityId)
  if (!own.ok) return { ok: false, error: "Không có quyền truy cập opportunity này" }

  // Verify the client_id matches the opportunity
  const { data: opp } = await admin
    .from("opportunities")
    .select("client_id, buyer_code, leads:lead_id ( company_name )")
    .eq("id", input.opportunityId)
    .single()

  if (!opp || opp.client_id !== input.clientId) {
    return { ok: false, error: "Opportunity không thuộc về client này" }
  }

  // Build HTML email
  const leadName = (opp.leads as { company_name?: string | null } | null)?.company_name ?? opp.buyer_code ?? "Buyer"
  const senderName = callerProfile.full_name ?? "Đội ngũ Vexim Trade"

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #0066cc;">Vexim Trade</h2>
        <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Cập nhật tiến độ thương vụ</p>
      </div>
      
      <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">
${escapeHtml(input.body)}
      </div>
      
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #666; font-size: 13px;">
        <p style="margin: 0;">Gửi bởi: ${escapeHtml(senderName)}</p>
        <p style="margin: 4px 0 0;">Buyer: ${escapeHtml(leadName)}</p>
      </div>
    </div>
  `

  try {
    const fromAddress = buildPersonalizedSender(senderName, {
      workEmail: callerProfile.work_email,
    })
    await sendMail({
      from: fromAddress,
      replyTo: callerProfile.work_email || getSenderEmail("trade"),
      to: input.to,
      subject: input.subject,
      html: htmlBody,
      text: input.body,
    })

    // Log activity
    await admin.from("activities").insert({
      opportunity_id: input.opportunityId,
      action_type: "client_email_sent",
      description: `Email gửi cho client: "${input.subject}"`,
      performed_by: user.id,
    })

    return { ok: true }
  } catch (err) {
    console.error("[v0] sendClientUpdateEmail failed:", err)
    return { ok: false, error: "Gửi email thất bại. Vui lòng thử lại." }
  }
}

/** Escape HTML special characters */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
