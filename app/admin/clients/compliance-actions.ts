"use server"

/**
 * Server actions for the Client Compliance workspace (Sprint B / SOP §0.2–0.3).
 *
 * Responsibilities:
 *  - Upload / delete compliance documents (FDA cert, COA, price floor,
 *    factory video/photos, other) scoped to a single client profile.
 *  - Create and revoke tokenized share links that buyers can open via
 *    `/share/[token]` without authenticating (default TTL 30 days).
 *
 * Security model:
 *  - All mutations require an authenticated admin. We use the admin Supabase
 *    client to bypass RLS for controlled operations; authorization is
 *    enforced in-process by checking the caller's `profiles.role`.
 */
import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import {
  uploadComplianceDoc,
  deleteComplianceDocByUrl,
  validateComplianceFile,
  COMPLIANCE_DOC_KINDS,
  type ComplianceDocKind,
} from "@/lib/blob/client-docs"
import { sendMail, getFromAddress } from "@/lib/email/mailer"
import { siteConfig } from "@/lib/site-config"

// Which doc kinds are safe to share with external buyers. Must stay in
// sync with `TOKEN_SHAREABLE_KINDS` in app/api/files/route.ts and
// `SHAREABLE_KINDS` in the workspace UI.
const TOKEN_SHAREABLE_KINDS: ComplianceDocKind[] = [
  "factory_video",
  "factory_photo",
  "price_floor",
]

const KIND_LABELS_VI: Record<ComplianceDocKind, string> = {
  fda_certificate: "Chứng chỉ FDA",
  coa: "Giấy chứng nhận phân tích (COA)",
  price_floor: "Bảng giá sàn",
  factory_video: "Video nhà máy",
  factory_photo: "Ảnh nhà máy",
  other: "Tài liệu khác",
}

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// All client compliance writes gate on CAPS.CLIENT_COMPLIANCE_WRITE
// (admin, super_admin, account_executive, staff).

// ────────────────────────────────────────────────────────────────────────────
// Compliance Docs
// ────────────────────────────────────────────────────────────────────────────

export async function uploadClientDocAction(
  formData: FormData,
): Promise<ActionResult<{ url: string; id: string }>> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient, userId } = guard

  const ownerId = String(formData.get("ownerId") ?? "")
  const kind = String(formData.get("kind") ?? "") as ComplianceDocKind
  const title = String(formData.get("title") ?? "").trim() || null
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim()
  const expiresAt = expiresAtRaw || null
  const notes = String(formData.get("notes") ?? "").trim() || null
  const file = formData.get("file") as File | null

  if (!ownerId) return { ok: false, error: "missingClient" }
  if (!COMPLIANCE_DOC_KINDS.includes(kind)) {
    return { ok: false, error: "invalidDocType" }
  }
  if (!file || file.size === 0) return { ok: false, error: "missingFile" }

  const validation = validateComplianceFile(file)
  if (!validation.ok) {
    return { ok: false, error: validation.errorKey! }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: "missingToken" }
  }

  let uploaded: { pathname: string }
  try {
    uploaded = await uploadComplianceDoc({ ownerId, kind, file })
  } catch (err) {
    console.error("[v0] uploadComplianceDoc failed", err)
    return { ok: false, error: "uploadFailed" }
  }

  const { data, error } = await adminClient
    .from("compliance_docs")
    .insert({
      owner_id: ownerId,
      kind,
      title,
      // `compliance_docs.url` now holds the blob *pathname*, not a
      // public URL — the store is private and files are served via
      // `/api/files?path=<pathname>`.
      url: uploaded.pathname,
      mime_type: file.type,
      size_bytes: file.size,
      expires_at: expiresAt,
      notes,
      uploaded_by: userId ?? null,
    })
    .select("id")
    .single()

  if (error || !data) {
    // Roll back the blob so we don't leak orphans.
    await deleteComplianceDocByUrl(uploaded.pathname)
    console.error("[v0] compliance_docs insert failed", error)
    return { ok: false, error: "dbInsertFailed" }
  }

  // The expiry date lives on the compliance_docs row itself; kanban checks
  // read it from there. No profile update needed.
  revalidatePath(`/admin/clients/${ownerId}`)
  return { ok: true, data: { url: uploaded.pathname, id: data.id } }
}

export async function deleteClientDocAction(
  docId: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient } = guard

  const { data: doc, error: fetchErr } = await adminClient
    .from("compliance_docs")
    .select("id, owner_id, url")
    .eq("id", docId)
    .single()

  if (fetchErr || !doc) return { ok: false, error: "notFound" }

  const { error: delErr } = await adminClient
    .from("compliance_docs")
    .delete()
    .eq("id", docId)

  if (delErr) {
    console.error("[v0] compliance_docs delete failed", delErr)
    return { ok: false, error: "dbDeleteFailed" }
  }

  await deleteComplianceDocByUrl(doc.url)
  revalidatePath(`/admin/clients/${doc.owner_id}`)
  return { ok: true }
}

// ────────────────────────────────────────────────────────────────────────────
// Tokenized Share Links (SOP §0.3)
// ────────────────────────────────────────────────────────────────────────────

export async function createShareLinkAction(args: {
  docId: string
  ttlDays?: number
  note?: string | null
  /**
   * Optional — when provided, the server will email the share link to
   * this buyer via Zoho SMTP after the link is created. Sending is
   * best-effort: the link itself is still created even if the email
   * fails, and the caller gets `emailSent: false` so the UI can toast
   * a partial-success message.
   */
  buyerEmail?: string | null
  buyerName?: string | null
  buyerCompany?: string | null
  senderMessage?: string | null
}): Promise<
  ActionResult<{ token: string; emailSent: boolean; emailError?: string }>
> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient, userId } = guard

  const ttlDays = args.ttlDays && args.ttlDays > 0 ? args.ttlDays : 30
  const expiresAt = new Date(
    Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  // Need owner_id + kind + title so we can validate share-ability and
  // build a meaningful email. Joining profile gives us the client
  // company name for the "from factory X" line.
  const { data: doc, error: docErr } = await adminClient
    .from("compliance_docs")
    .select(
      "id, owner_id, kind, title, owner:profiles!compliance_docs_owner_id_fkey(full_name, company_name)",
    )
    .eq("id", args.docId)
    .single()

  if (docErr || !doc) return { ok: false, error: "notFound" }

  // Defence-in-depth: never allow sharing kinds not on the whitelist,
  // even if the UI somehow submits one.
  if (!TOKEN_SHAREABLE_KINDS.includes(doc.kind as ComplianceDocKind)) {
    return { ok: false, error: "kindNotShareable" }
  }

  const { data, error } = await adminClient
    .from("tokenized_share_links")
    .insert({
      doc_id: doc.id,
      owner_id: doc.owner_id,
      expires_at: expiresAt,
      note: args.note ?? null,
      created_by: userId ?? null,
    })
    .select("token")
    .single()

  if (error || !data) {
    console.error("[v0] createShareLink failed", error)
    return { ok: false, error: "dbInsertFailed" }
  }

  const token = data.token as string
  revalidatePath(`/admin/clients/${doc.owner_id}`)

  // --- Optional buyer email --------------------------------------------
  let emailSent = false
  let emailError: string | undefined

  const buyerEmail = args.buyerEmail?.trim()
  if (buyerEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      return {
        ok: true,
        data: { token, emailSent: false, emailError: "invalidEmail" },
      }
    }

    // Type gymnastics: Supabase's PostgREST join may return an object or
    // an array depending on whether the relation is singular. We just
    // pick the first available value.
    const ownerRel = (doc as { owner?: unknown }).owner
    const owner = Array.isArray(ownerRel) ? ownerRel[0] : ownerRel
    const clientCompany =
      (owner as { company_name?: string | null } | undefined)?.company_name ??
      (owner as { full_name?: string | null } | undefined)?.full_name ??
      "Nhà sản xuất đối tác Vexim Bridge"

    const shareUrl = `${siteConfig.url}/share/${token}`
    const docLabel =
      KIND_LABELS_VI[doc.kind as ComplianceDocKind] ??
      String(doc.title ?? "Tài liệu")
    const expiresLabel = new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "long",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(expiresAt))

    const result = await sendMail({
      to: buyerEmail,
      subject: `[Vexim Bridge] ${docLabel} từ ${clientCompany}`,
      html: renderBuyerShareEmail({
        buyerName: args.buyerName?.trim() || null,
        buyerCompany: args.buyerCompany?.trim() || null,
        clientCompany,
        docLabel,
        docTitle: doc.title ?? null,
        shareUrl,
        expiresLabel,
        ttlDays,
        senderMessage: args.senderMessage?.trim() || null,
      }),
      text: renderBuyerShareEmailText({
        buyerName: args.buyerName?.trim() || null,
        clientCompany,
        docLabel,
        shareUrl,
        expiresLabel,
        ttlDays,
        senderMessage: args.senderMessage?.trim() || null,
      }),
      // When the buyer hits "Reply", it should go to the Zoho mailbox
      // the team monitors (same as consultation form).
      headers: { "Reply-To": getFromAddress() },
    })

    if (result.error) {
      console.error(
        "[v0] createShareLink: buyer email failed",
        result.error.message,
      )
      emailError = result.error.message
    } else {
      emailSent = true
    }
  }

  return { ok: true, data: { token, emailSent, emailError } }
}

// ────────────────────────────────────────────────────────────────────────────
// Resend an existing share link to a buyer (e.g. follow-up email).
// ────────────────────────────────────────────────────────────────────────────

export async function resendShareLinkEmailAction(args: {
  token: string
  buyerEmail: string
  buyerName?: string | null
  buyerCompany?: string | null
  senderMessage?: string | null
}): Promise<ActionResult<{ emailSent: boolean }>> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient } = guard

  const buyerEmail = args.buyerEmail?.trim()
  if (!buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return { ok: false, error: "invalidEmail" }
  }

  const { data: link, error: linkErr } = await adminClient
    .from("tokenized_share_links")
    .select(
      "token, expires_at, revoked_at, doc:compliance_docs!tokenized_share_links_doc_id_fkey(id, kind, title, owner:profiles!compliance_docs_owner_id_fkey(full_name, company_name))",
    )
    .eq("token", args.token)
    .single()

  if (linkErr || !link) return { ok: false, error: "notFound" }
  if (link.revoked_at) return { ok: false, error: "linkRevoked" }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "linkExpired" }
  }

  const docRel = (link as { doc?: unknown }).doc
  const doc = Array.isArray(docRel) ? docRel[0] : docRel
  const ownerRel = (doc as { owner?: unknown } | undefined)?.owner
  const owner = Array.isArray(ownerRel) ? ownerRel[0] : ownerRel

  const clientCompany =
    (owner as { company_name?: string | null } | undefined)?.company_name ??
    (owner as { full_name?: string | null } | undefined)?.full_name ??
    "Nhà sản xuất đối tác Vexim Bridge"

  const kind = (doc as { kind?: string } | undefined)?.kind as
    | ComplianceDocKind
    | undefined
  const docLabel = (kind && KIND_LABELS_VI[kind]) || "Tài liệu"
  const docTitle = (doc as { title?: string | null } | undefined)?.title ?? null

  const shareUrl = `${siteConfig.url}/share/${link.token}`
  const expiresLabel = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(link.expires_at))
  const ttlDays = Math.max(
    1,
    Math.round(
      (new Date(link.expires_at).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000),
    ),
  )

  const result = await sendMail({
    to: buyerEmail,
    subject: `[Vexim Bridge] ${docLabel} từ ${clientCompany}`,
    html: renderBuyerShareEmail({
      buyerName: args.buyerName?.trim() || null,
      buyerCompany: args.buyerCompany?.trim() || null,
      clientCompany,
      docLabel,
      docTitle,
      shareUrl,
      expiresLabel,
      ttlDays,
      senderMessage: args.senderMessage?.trim() || null,
    }),
    text: renderBuyerShareEmailText({
      buyerName: args.buyerName?.trim() || null,
      clientCompany,
      docLabel,
      shareUrl,
      expiresLabel,
      ttlDays,
      senderMessage: args.senderMessage?.trim() || null,
    }),
    headers: { "Reply-To": getFromAddress() },
  })

  if (result.error) {
    console.error(
      "[v0] resendShareLinkEmail failed",
      result.error.message,
    )
    return { ok: false, error: "emailFailed" }
  }

  return { ok: true, data: { emailSent: true } }
}

// ────────────────────────────────────────────────────────────────────────────
// Email rendering for buyer share links
// Inline styles only — Gmail / Outlook strip <style> blocks.
// ────────────────────────────────────────────────────────────────────────────

interface BuyerEmailData {
  buyerName: string | null
  buyerCompany: string | null
  clientCompany: string
  docLabel: string
  docTitle: string | null
  shareUrl: string
  expiresLabel: string
  ttlDays: number
  senderMessage: string | null
}

function renderBuyerShareEmail(d: BuyerEmailData): string {
  const greeting = d.buyerName
    ? `Chào ${escapeHtml(d.buyerName)},`
    : "Chào bạn,"

  const senderMessageBlock = d.senderMessage
    ? `
      <tr><td style="padding:18px 28px 0;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 18px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;white-space:pre-wrap;">
          ${escapeHtml(d.senderMessage)}
        </div>
      </td></tr>`
    : ""

  const docTitleLine = d.docTitle
    ? `<div style="font:13px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;margin-top:2px;">${escapeHtml(d.docTitle)}</div>`
    : ""

  return `<!DOCTYPE html>
<html lang="vi">
  <head><meta charset="utf-8" /><title>${escapeHtml(d.docLabel)}</title></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:560px;width:100%;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Bridge</div>
              <div style="margin-top:4px;font:700 18px/26px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">Hồ sơ nhà sản xuất Việt Nam</div>
            </td>
          </tr>
          <tr><td style="height:4px;background:#14b8a6;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:28px 28px 0;">
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
              ${greeting}
            </p>
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
              Vexim Bridge gửi bạn <strong>${escapeHtml(d.docLabel)}</strong> của nhà sản xuất <strong>${escapeHtml(d.clientCompany)}</strong> để tham khảo trong quá trình đánh giá nguồn cung.
            </p>
            ${docTitleLine}
          </td></tr>
          ${senderMessageBlock}
          <tr><td style="padding:24px 28px 8px;" align="center">
            <a href="${escapeAttr(d.shareUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              Xem tài liệu an toàn
            </a>
            <div style="margin-top:10px;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
              Liên kết hợp lệ đến ${escapeHtml(d.expiresLabel)} (khoảng ${d.ttlDays} ngày).
            </div>
          </td></tr>
          <tr><td style="padding:20px 28px 0;font:13px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;">
            Hoặc copy đường dẫn sau vào trình duyệt:<br/>
            <a href="${escapeAttr(d.shareUrl)}" style="color:#0f172a;word-break:break-all;">${escapeHtml(d.shareUrl)}</a>
          </td></tr>
          <tr><td style="padding:22px 28px 0;font:13px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
            Vexim Bridge đóng vai trò phòng kinh doanh xuất khẩu thuê ngoài cho các nhà sản xuất Việt Nam đã đăng ký FDA. Nếu bạn muốn trao đổi thêm về giá, MOQ hoặc quy trình đặt hàng, hãy trả lời trực tiếp email này — đội ngũ của chúng tôi sẽ phản hồi trong 1 ngày làm việc.
          </td></tr>
          <tr><td style="padding:22px 28px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
            Trân trọng,<br/>
            <strong>Đội ngũ Vexim Bridge</strong>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
            Email tự động từ ${escapeHtml(siteConfig.name)} · ${escapeHtml(siteConfig.url)}<br/>
            Bạn nhận được email này vì đối tác của chúng tôi đã chia sẻ hồ sơ nhà máy với bạn.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

interface BuyerEmailTextData {
  buyerName: string | null
  clientCompany: string
  docLabel: string
  shareUrl: string
  expiresLabel: string
  ttlDays: number
  senderMessage: string | null
}

function renderBuyerShareEmailText(d: BuyerEmailTextData): string {
  const lines = [
    d.buyerName ? `Chào ${d.buyerName},` : "Chào bạn,",
    "",
    `Vexim Bridge gửi bạn ${d.docLabel} của nhà sản xuất ${d.clientCompany} để tham khảo trong quá trình đánh giá nguồn cung.`,
  ]
  if (d.senderMessage) {
    lines.push("", "Ghi chú từ đội ngũ phụ trách:", d.senderMessage)
  }
  lines.push(
    "",
    "Xem tài liệu:",
    d.shareUrl,
    "",
    `Liên kết hợp lệ đến ${d.expiresLabel} (khoảng ${d.ttlDays} ngày).`,
    "",
    "Nếu bạn muốn trao đổi thêm về giá, MOQ hoặc quy trình đặt hàng, hãy trả lời trực tiếp email này.",
    "",
    "— Đội ngũ Vexim Bridge",
    siteConfig.url,
  )
  return lines.join("\n")
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}

// ────────────────────────────────────────────────────────────────────────────
// Revoke
// ────────────────────────────────────────────────────────────────────────────

export async function revokeShareLinkAction(
  token: string,
): Promise<ActionResult> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }
  const { admin: adminClient } = guard

  const { data: link, error: fetchErr } = await adminClient
    .from("tokenized_share_links")
    .select("token, owner_id")
    .eq("token", token)
    .single()

  if (fetchErr || !link) return { ok: false, error: "notFound" }

  const { error } = await adminClient
    .from("tokenized_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token)

  if (error) return { ok: false, error: "dbUpdateFailed" }

  revalidatePath(`/admin/clients/${link.owner_id}`)
  return { ok: true }
}
