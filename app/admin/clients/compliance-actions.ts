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

// Which doc kinds are safe to share with external buyers via a public
// tokenized link. The Vexim team handles redaction of sensitive fields
// (legal name, FDA reg number, factory address) at the upload step —
// this whitelist is intentionally permissive. Keep in sync with
// `PUBLICLY_SHAREABLE_KINDS` (app/api/files/route.ts) and
// `SHAREABLE_KINDS` (workspace UI).
const TOKEN_SHAREABLE_KINDS: ComplianceDocKind[] = [
  "fda_certificate",
  "coa",
  "price_floor",
  "factory_video",
  "factory_photo",
  "other",
]

// Buyer-facing labels are in English — buyers are predominantly US-based
// and the share links / email templates all target English recipients.
const KIND_LABELS_EN: Record<ComplianceDocKind, string> = {
  fda_certificate: "FDA Certificate",
  coa: "Certificate of Analysis (COA)",
  price_floor: "Price Sheet",
  factory_video: "Factory Video",
  factory_photo: "Factory Photos",
  other: "Additional Document",
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
      "A Vexim Bridge manufacturing partner"

    const shareUrl = `${siteConfig.url}/share/${token}`
    const docLabel =
      KIND_LABELS_EN[doc.kind as ComplianceDocKind] ??
      String(doc.title ?? "Document")
    // Buyer-facing emails default to US English formatting.
    const expiresLabel = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(expiresAt))

    const result = await sendMail({
      to: buyerEmail,
      subject: `[Vexim Bridge] ${docLabel} from ${clientCompany}`,
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
// Bundle share links — one tokenized URL → many compliance docs
// (migration 022). Implementation notes:
//   - Inserts tokenized_share_links with doc_id = NULL.
//   - Lists the docs in tokenized_share_link_docs.
//   - Only shareable kinds (factory_video, factory_photo, price_floor)
//     may be bundled. All docs must belong to the same owner.
// ────────────────────────────────────────────────────────────────────────────

export async function createBundleShareLinkAction(args: {
  docIds: string[]
  ttlDays?: number
  note?: string | null
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

  // Dedupe incoming ids defensively — the UI passes a Set, but a direct
  // caller could submit duplicates.
  const docIds = Array.from(new Set(args.docIds.filter(Boolean)))
  if (docIds.length === 0) return { ok: false, error: "noDocs" }

  const ttlDays = args.ttlDays && args.ttlDays > 0 ? args.ttlDays : 30
  const expiresAt = new Date(
    Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  // Fetch every selected doc so we can validate ownership, kind, and
  // assemble the email. `in()` is O(ids) so this is a single round-trip.
  const { data: docs, error: docsErr } = await adminClient
    .from("compliance_docs")
    .select(
      "id, owner_id, kind, title, owner:profiles!compliance_docs_owner_id_fkey(full_name, company_name)",
    )
    .in("id", docIds)

  if (docsErr || !docs || docs.length === 0) {
    return { ok: false, error: "notFound" }
  }

  // Every doc must belong to the same client — bundling across
  // different owners would bypass client-scoped visibility.
  const ownerId = docs[0].owner_id
  if (docs.some((d) => d.owner_id !== ownerId)) {
    return { ok: false, error: "mixedOwners" }
  }

  // Filter out non-shareable kinds. If nothing remains, bail early
  // instead of creating an empty bundle.
  const shareableDocs = docs.filter((d) =>
    TOKEN_SHAREABLE_KINDS.includes(d.kind as ComplianceDocKind),
  )
  if (shareableDocs.length === 0) {
    return { ok: false, error: "kindNotShareable" }
  }

  const { data: linkRow, error: linkErr } = await adminClient
    .from("tokenized_share_links")
    .insert({
      doc_id: null,
      owner_id: ownerId,
      expires_at: expiresAt,
      note: args.note ?? null,
      created_by: userId ?? null,
    })
    .select("token")
    .single()

  if (linkErr || !linkRow) {
    console.error("[v0] createBundleShareLink: link insert failed", linkErr)
    return { ok: false, error: "dbInsertFailed" }
  }

  const token = linkRow.token as string

  const joinRows = shareableDocs.map((d, idx) => ({
    token,
    doc_id: d.id,
    position: idx,
  }))
  const { error: joinErr } = await adminClient
    .from("tokenized_share_link_docs")
    .insert(joinRows)

  if (joinErr) {
    // Roll back the parent link so we don't leave an empty bundle
    // stuck in the table.
    await adminClient
      .from("tokenized_share_links")
      .delete()
      .eq("token", token)
    console.error("[v0] createBundleShareLink: join insert failed", joinErr)
    return { ok: false, error: "dbInsertFailed" }
  }

  revalidatePath(`/admin/clients/${ownerId}`)

  // --- Optional buyer email ------------------------------------------------
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

    const ownerRel = (shareableDocs[0] as { owner?: unknown }).owner
    const owner = Array.isArray(ownerRel) ? ownerRel[0] : ownerRel
    const clientCompany =
      (owner as { company_name?: string | null } | undefined)?.company_name ??
      (owner as { full_name?: string | null } | undefined)?.full_name ??
      "A Vexim Bridge manufacturing partner"

    const shareUrl = `${siteConfig.url}/share/${token}`
    const expiresLabel = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(expiresAt))

    // Build a human-readable list of docs for the email body.
    const docItems = shareableDocs.map((d) => ({
      label:
        KIND_LABELS_EN[d.kind as ComplianceDocKind] ??
        String(d.title ?? "Document"),
      title: (d.title ?? null) as string | null,
    }))

    const result = await sendMail({
      to: buyerEmail,
      subject: `[Vexim Bridge] Dossier from ${clientCompany} (${shareableDocs.length} documents)`,
      html: renderBundleBuyerEmail({
        buyerName: args.buyerName?.trim() || null,
        buyerCompany: args.buyerCompany?.trim() || null,
        clientCompany,
        docs: docItems,
        shareUrl,
        expiresLabel,
        ttlDays,
        senderMessage: args.senderMessage?.trim() || null,
      }),
      text: renderBundleBuyerEmailText({
        buyerName: args.buyerName?.trim() || null,
        clientCompany,
        docs: docItems,
        shareUrl,
        expiresLabel,
        ttlDays,
        senderMessage: args.senderMessage?.trim() || null,
      }),
      headers: { "Reply-To": getFromAddress() },
    })

    if (result.error) {
      console.error(
        "[v0] createBundleShareLink: buyer email failed",
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
    "A Vexim Bridge manufacturing partner"

  const kind = (doc as { kind?: string } | undefined)?.kind as
    | ComplianceDocKind
    | undefined
  const docLabel = (kind && KIND_LABELS_EN[kind]) || "Document"
  const docTitle = (doc as { title?: string | null } | undefined)?.title ?? null

  const shareUrl = `${siteConfig.url}/share/${link.token}`
  const expiresLabel = new Intl.DateTimeFormat("en-US", {
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
    subject: `[Vexim Bridge] ${docLabel} from ${clientCompany}`,
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
    ? `Hi ${escapeHtml(d.buyerName)},`
    : "Hello,"

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
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(d.docLabel)}</title></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:560px;width:100%;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Bridge</div>
              <div style="margin-top:4px;font:700 18px/26px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">Vietnamese Manufacturer Dossier</div>
            </td>
          </tr>
          <tr><td style="height:4px;background:#14b8a6;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:28px 28px 0;">
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
              ${greeting}
            </p>
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
              Vexim Bridge is sharing the <strong>${escapeHtml(d.docLabel)}</strong> from our manufacturing partner <strong>${escapeHtml(d.clientCompany)}</strong> to support your supplier evaluation.
            </p>
            ${docTitleLine}
          </td></tr>
          ${senderMessageBlock}
          <tr><td style="padding:24px 28px 8px;" align="center">
            <a href="${escapeAttr(d.shareUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              View document securely
            </a>
            <div style="margin-top:10px;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
              Link valid until ${escapeHtml(d.expiresLabel)} (about ${d.ttlDays} days).
            </div>
          </td></tr>
          <tr><td style="padding:20px 28px 0;font:13px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;">
            Or copy this URL into your browser:<br/>
            <a href="${escapeAttr(d.shareUrl)}" style="color:#0f172a;word-break:break-all;">${escapeHtml(d.shareUrl)}</a>
          </td></tr>
          <tr><td style="padding:22px 28px 0;font:13px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
            Vexim Bridge operates as the outsourced export sales arm for FDA-registered Vietnamese manufacturers. If you&rsquo;d like to discuss pricing, MOQ or the ordering process, simply reply to this email &mdash; our team responds within one business day.
          </td></tr>
          <tr><td style="padding:22px 28px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
            Best regards,<br/>
            <strong>The Vexim Bridge Team</strong>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
            Automated message from ${escapeHtml(siteConfig.name)} &middot; ${escapeHtml(siteConfig.url)}<br/>
            You are receiving this email because our partner shared their factory dossier with you.
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
    d.buyerName ? `Hi ${d.buyerName},` : "Hello,",
    "",
    `Vexim Bridge is sharing the ${d.docLabel} from our manufacturing partner ${d.clientCompany} to support your supplier evaluation.`,
  ]
  if (d.senderMessage) {
    lines.push("", "Note from your account team:", d.senderMessage)
  }
  lines.push(
    "",
    "View the document:",
    d.shareUrl,
    "",
    `Link valid until ${d.expiresLabel} (about ${d.ttlDays} days).`,
    "",
    "If you'd like to discuss pricing, MOQ or the ordering process, simply reply to this email.",
    "",
    "— The Vexim Bridge Team",
    siteConfig.url,
  )
  return lines.join("\n")
}

// --- Bundle variant (multi-doc) ------------------------------------------

interface BundleBuyerEmailData {
  buyerName: string | null
  buyerCompany: string | null
  clientCompany: string
  docs: { label: string; title: string | null }[]
  shareUrl: string
  expiresLabel: string
  ttlDays: number
  senderMessage: string | null
}

function renderBundleBuyerEmail(d: BundleBuyerEmailData): string {
  const greeting = d.buyerName
    ? `Hi ${escapeHtml(d.buyerName)},`
    : "Hello,"

  const senderMessageBlock = d.senderMessage
    ? `
      <tr><td style="padding:18px 28px 0;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 18px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;white-space:pre-wrap;">
          ${escapeHtml(d.senderMessage)}
        </div>
      </td></tr>`
    : ""

  const docListItems = d.docs
    .map((item) => {
      const titleLine = item.title
        ? `<div style="color:#64748b;font-size:12px;line-height:18px;margin-top:2px;">${escapeHtml(item.title)}</div>`
        : ""
      return `
        <li style="margin:0 0 10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;list-style:none;">
          <div style="color:#0f172a;font-weight:600;font-size:14px;line-height:20px;">${escapeHtml(item.label)}</div>
          ${titleLine}
        </li>`
    })
    .join("")

  // Pluralize "document" for the summary line — 1 doc reads naturally too.
  const docCountLabel =
    d.docs.length === 1 ? "1 document" : `${d.docs.length} documents`

  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Dossier from ${escapeHtml(d.clientCompany)}</title></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;max-width:560px;width:100%;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <div style="font:600 12px/16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Vexim Bridge</div>
              <div style="margin-top:4px;font:700 18px/26px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">Vietnamese Manufacturer Dossier</div>
            </td>
          </tr>
          <tr><td style="height:4px;background:#14b8a6;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:28px 28px 0;">
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
              ${greeting}
            </p>
            <p style="margin:0 0 14px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
              Vexim Bridge is sharing <strong>${docCountLabel}</strong> from our manufacturing partner <strong>${escapeHtml(d.clientCompany)}</strong> to support your supplier evaluation.
            </p>
          </td></tr>
          ${senderMessageBlock}
          <tr><td style="padding:18px 28px 0;">
            <ul style="margin:0;padding:0;">
              ${docListItems}
            </ul>
          </td></tr>
          <tr><td style="padding:16px 28px 8px;" align="center">
            <a href="${escapeAttr(d.shareUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font:600 14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              View all documents
            </a>
            <div style="margin-top:10px;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
              Link valid until ${escapeHtml(d.expiresLabel)} (about ${d.ttlDays} days).
            </div>
          </td></tr>
          <tr><td style="padding:20px 28px 0;font:13px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#64748b;">
            Or copy this URL into your browser:<br/>
            <a href="${escapeAttr(d.shareUrl)}" style="color:#0f172a;word-break:break-all;">${escapeHtml(d.shareUrl)}</a>
          </td></tr>
          <tr><td style="padding:22px 28px 0;font:13px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569;">
            Vexim Bridge operates as the outsourced export sales arm for FDA-registered Vietnamese manufacturers. If you&rsquo;d like to discuss pricing, MOQ or the ordering process, simply reply to this email &mdash; our team responds within one business day.
          </td></tr>
          <tr><td style="padding:22px 28px;font:14px/22px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
            Best regards,<br/>
            <strong>The Vexim Bridge Team</strong>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font:12px/18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#94a3b8;">
            Automated message from ${escapeHtml(siteConfig.name)} &middot; ${escapeHtml(siteConfig.url)}<br/>
            You are receiving this email because our partner shared their factory dossier with you.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

interface BundleBuyerEmailTextData {
  buyerName: string | null
  clientCompany: string
  docs: { label: string; title: string | null }[]
  shareUrl: string
  expiresLabel: string
  ttlDays: number
  senderMessage: string | null
}

function renderBundleBuyerEmailText(d: BundleBuyerEmailTextData): string {
  const docCountLabel =
    d.docs.length === 1 ? "1 document" : `${d.docs.length} documents`
  const lines = [
    d.buyerName ? `Hi ${d.buyerName},` : "Hello,",
    "",
    `Vexim Bridge is sharing ${docCountLabel} from our manufacturing partner ${d.clientCompany} to support your supplier evaluation.`,
  ]
  if (d.senderMessage) {
    lines.push("", "Note from your account team:", d.senderMessage)
  }
  lines.push("", "Documents included:")
  d.docs.forEach((item, idx) => {
    const suffix = item.title ? ` — ${item.title}` : ""
    lines.push(`  ${idx + 1}. ${item.label}${suffix}`)
  })
  lines.push(
    "",
    "View all documents:",
    d.shareUrl,
    "",
    `Link valid until ${d.expiresLabel} (about ${d.ttlDays} days).`,
    "",
    "If you'd like to discuss pricing, MOQ or the ordering process, simply reply to this email.",
    "",
    "— The Vexim Bridge Team",
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
