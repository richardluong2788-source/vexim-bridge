"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"
import { siteConfig } from "@/lib/site-config"
import { rematchOpenSharedInboxLeads } from "@/lib/matching/rematch-shared-inbox"
import { sendClientInviteEmail } from "@/lib/email/client-invite-email"

export interface CreateClientInput {
  email: string
  full_name: string
  company_name: string
  /**
   * Ordered list of industries the client operates in.
   * `industries[0]` is treated as the primary industry (used by AI email
   * generator) and is mirrored to the legacy `industry` column by a DB
   * trigger for backward compatibility.
   */
  industries: Industry[]
  fda_registration_number?: string | null
  fda_expires_at?: string | null // YYYY-MM-DD
  fda_status?: string | null
  phone?: string | null
  /**
   * Country the client (supplier) company is based in. Free text — feeds
   * calculateCountryMatch() in lib/matching/scorer.ts so AE auto-assignment
   * can compare against a buyer's country.
   */
  country?: string | null
  /**
   * Supplier Researcher who sourced this client. When the caller is an SR,
   * this defaults to the caller id; pass it explicitly for intake approvals
   * so the sourcing attribution survives the review step.
   */
  sourced_by?: string | null
}

export interface CreateClientResult {
  ok: boolean
  userId?: string
  inviteLink?: string | null
  error?: string
}

/**
 * Admin-only: provision a new client account.
 *
 * Flow:
 *   1. Verify caller is authenticated admin/staff (via RLS-bound read).
 *   2. Use service-role client to invite the user by email. Supabase
 *      returns an auth user row + generates a magic sign-in link that
 *      doubles as the "welcome email" for the client.
 *   3. Upsert profiles row with role='client' and business metadata
 *      (company, industries, FDA). Industries are validated against the
 *      canonical list so AI email generation can rely on them. The DB
 *      trigger `profiles_sync_primary_industry` keeps the legacy
 *      `industry` column in sync with `industries[0]`.
 */
export async function createClientAccount(
  input: CreateClientInput,
): Promise<CreateClientResult> {
  // ---- 1. Validate input ----------------------------------------------------
  const email = input.email?.trim().toLowerCase()
  const fullName = input.full_name?.trim()
  const company = input.company_name?.trim()

  // Deduplicate (preserve order) and validate against the canonical list.
  const industries: Industry[] = []
  const seen = new Set<string>()
  for (const raw of input.industries ?? []) {
    if (typeof raw !== "string") continue
    if (seen.has(raw)) continue
    if (!(INDUSTRIES as readonly string[]).includes(raw)) continue
    seen.add(raw)
    industries.push(raw as Industry)
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" }
  }
  if (!fullName) return { ok: false, error: "full_name_required" }
  if (!company) return { ok: false, error: "company_required" }
  if (industries.length === 0) {
    return { ok: false, error: "industry_invalid" }
  }

  // FDA fields: optional, but if expiry is provided it must parse.
  let fdaExpiresAt: string | null = null
  if (input.fda_expires_at) {
    const d = new Date(input.fda_expires_at)
    if (isNaN(d.getTime())) {
      return { ok: false, error: "fda_expires_at_invalid" }
    }
    fdaExpiresAt = input.fda_expires_at
  }
  const rawFdaNumber = input.fda_registration_number?.trim() || null

  const isPending =
    input.fda_status === "pending_supplement" ||
    input.fda_status === "in_progress" ||
    rawFdaNumber?.toLowerCase() === "pending" ||
    rawFdaNumber?.toLowerCase() === "dang_bo_sung" ||
    rawFdaNumber?.toLowerCase() === "đang bổ sung"

  const fdaStatusValue = isPending
    ? "pending_supplement"
    : rawFdaNumber
      ? "valid"
      : "missing"

  const fdaNumber =
    isPending &&
    (!rawFdaNumber ||
      rawFdaNumber.toLowerCase() === "pending" ||
      rawFdaNumber.toLowerCase() === "dang_bo_sung" ||
      rawFdaNumber.toLowerCase() === "đang bổ sung")
      ? "PENDING"
      : rawFdaNumber

  // ---- 2. Caller auth + role check ------------------------------------------
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, error: "unauthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  // Allow admin/staff/super_admin, account_executive and supplier_researcher
  // to create clients.
  // AE can create clients and will auto-become their account manager.
  // SR (supplier researcher) creates UNASSIGNED supplier profiles — the
  // AE assignment happens later via admin / AI matching, keeping the
  // sourcing and relationship-management responsibilities separate.
  const allowedRoles = [
    "admin",
    "staff",
    "super_admin",
    "account_executive",
    "supplier_researcher",
  ]
  if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  // Determine if caller is an AE (for auto-assignment) or an SR (sourcing
  // attribution — SR brings the supplier in; the AE assignment happens later).
  const isAE = callerProfile.role === "account_executive"
  const isSR = callerProfile.role === "supplier_researcher"
  const sourcedBy = input.sourced_by ?? (isSR ? caller.id : null)

  // ---- 3. Provision auth user via service role ------------------------------
  const admin = createAdminClient()

  // IMPORTANT: we deliberately do NOT use `admin.inviteUserByEmail()` here.
  // That call both creates the auth user AND auto-sends Supabase Auth's
  // own built-in invite email — a generic, unbranded "You have been
  // invited" message that Gmail/Outlook frequently route to Spam or
  // Promotions for first-time recipients (Resend/SMTP will still report
  // it as "Delivered", which only means the receiving mail server
  // accepted it — not that it reached the inbox).
  //
  // `generateLink({ type: "invite" })` performs the exact same user
  // creation but returns the action link WITHOUT sending any email,
  // letting us deliver it ourselves via `sendClientInviteEmail()` on our
  // own verified veximtrade.com Resend domain — the same channel that
  // already reliably reaches AE inboxes.
  //
  // The resulting link still points at the client-side /auth/accept-invite
  // page (not the server route /auth/callback): this flow doesn't use
  // PKCE, so Supabase returns the session tokens in the URL hash fragment
  // (`#access_token=...`), which only a browser-side client can read.
  // This URL must also match an entry in Supabase Dashboard →
  // Authentication → URL Configuration → Redirect URLs, otherwise
  // Supabase silently falls back to "Site URL".
  const redirectTo = `${siteConfig.url}/auth/accept-invite`

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        role: "client",
        full_name: fullName,
        company_name: company,
      },
      redirectTo,
    },
  })

  if (linkErr || !linkData?.user || !linkData?.properties?.action_link) {
    const msg = linkErr?.message ?? "invite_failed"
    if (/already/i.test(msg)) return { ok: false, error: "email_exists" }
    return { ok: false, error: msg }
  }

  const newUserId = linkData.user.id
  const actionLink = linkData.properties.action_link

  // ---- 4. Upsert profile with business metadata -----------------------------
  // We write `industries` (the multi-value column). The BEFORE trigger
  // `profiles_sync_primary_industry` will set `industry = industries[1]`
  // automatically, so legacy reads (lead-card, kanban, clients-table, AI
  // email generator) keep working without code changes.
  //
  // If the caller is an AE, auto-assign them as the account manager so
  // they can immediately see and work with this client. This enables
  // AE self-service client creation per the business requirement.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        role: "client",
        email,
        full_name: fullName,
        company_name: company,
        industries,
        phone: input.phone?.trim() || null,
        country: input.country?.trim() || null,
        fda_registration_number: fdaNumber,
        fda_expires_at: isPending ? null : fdaExpiresAt,
        fda_status: fdaStatusValue,
        // Auto-assign AE as account manager when they create the client
        account_manager_id: isAE ? caller.id : null,
        // SR who sourced this supplier (for billing-proposal / collections)
        sourced_by: sourcedBy,
      },
      { onConflict: "id" },
    )

  if (profileErr) {
    // Roll back auth user so admin can retry cleanly.
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: profileErr.message }
  }

  // ---- 4b. Send the branded activation email ourselves ---------------------
  // Not wrapped in try/rollback: the account already exists at this point,
  // and an admin/AE can always fall back to "Gửi lại link" (resendClientInvite)
  // if this send happens to fail — same pattern as the AE-notification email.
  const { error: inviteSendErr } = await sendClientInviteEmail({
    email,
    displayName: fullName || company,
    actionLink,
    variant: "invite",
  })
  if (inviteSendErr) {
    console.error(
      "[v0] createClientAccount: failed to send branded invite email:",
      inviteSendErr.message,
    )
  }

  // ---- 5. Audit trail (best-effort) ----------------------------------------
  // `activities` has no user_id/action/details columns (real schema:
  // id, opportunity_id, action_type, description, performed_by, created_at).
  try {
    await admin.from("activities").insert({
      opportunity_id: null,
      action_type: "client_created",
      description: JSON.stringify({
        new_client_id: newUserId,
        email,
        company_name: company,
        industries,
        primary_industry: industries[0],
        has_fda: !!fdaNumber,
        auto_assigned_ae: isAE ? caller.id : null,
        created_by_role: callerProfile.role,
      }),
      performed_by: caller.id,
    })
  } catch (auditErr) {
    console.error("[v0] createClientAccount: audit log failed:", auditErr)
  }

  revalidatePath("/admin/clients")
  revalidatePath("/admin/users")

  // ---- 6. Re-match any buyer stuck in the shared inbox for these
  // industries. Before this client existed, no AE may have covered
  // `industries` — buyers in that industry would have been routed to the
  // shared inbox (see routeToSharedInbox in lib/matching/orchestrator.ts)
  // and left there. Now that this AE has a client here, re-run matching so
  // those buyers get scored/auto-assigned right away instead of waiting on
  // the daily cron sweep. Best-effort — must never block client creation.
  if (isAE) {
    try {
      const summary = await rematchOpenSharedInboxLeads({
        industries,
        triggeredBy: caller.id,
      })
      if (summary.scanned > 0) {
        console.log(
          `[v0] Re-matched ${summary.scanned} shared-inbox buyer(s) after new client in [${industries.join(", ")}]:`,
          `auto-assigned=${summary.autoAssigned}, moved-to-inbox=${summary.movedToPerAeInbox}, still-unmatched=${summary.stillUnmatched}`,
        )
      }
    } catch (err) {
      console.error("[v0] rematchOpenSharedInboxLeads failed after client creation:", err)
    }
  }

  return {
    ok: true,
    userId: newUserId,
    inviteLink: null,
  }
}

export interface CreateIntakeLinkResult {
  ok: boolean
  url?: string
  expiresAt?: string
  error?: string
}

/**
 * Admin/AE/SR: generate a single-use public intake link
 * (/client-intake/[token]) that a prospective client can fill in without
 * logging in. The row lives in `client_intake_submissions` — fully
 * decoupled from `profiles` — until it's reviewed and approved in
 * "Hồ sơ chờ duyệt".
 *
 * supplier_researcher (SR) owns the supplier pipeline end-to-end, so SR is
 * allowed to generate intake links just like admin/AE. The resulting
 * submission is owned by the caller (`ae_id = caller.id`), and SR is
 * already in REVIEWER_ROLES (intake/actions.ts) so they can approve it
 * later too.
 */
export async function createIntakeLink(prefill?: {
  email?: string
  company_name?: string
  contact_name?: string
  phone?: string
  industries?: string[]
  client_id?: string
}): Promise<CreateIntakeLinkResult> {
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, error: "unauthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  const allowedRoles = [
    "admin",
    "staff",
    "super_admin",
    "account_executive",
    "supplier_researcher",
  ]
  if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const token = randomBytes(24).toString("base64url")
  const admin = createAdminClient()

  // Prefill from existing client if client_id provided
  let prefillData: Record<string, any> = {}
  if (prefill?.client_id) {
    const { data: client } = await admin
      .from("profiles")
      .select("email, full_name, company_name, industries, phone")
      .eq("id", prefill.client_id)
      .maybeSingle()
    if (client) {
      prefillData = {
        email: client.email ?? prefill.email ?? null,
        contact_name: client.full_name ?? prefill.contact_name ?? null,
        company_name: client.company_name ?? prefill.company_name ?? null,
        industries: client.industries ?? prefill.industries ?? [],
        phone: client.phone ?? prefill.phone ?? null,
      }
    }
  } else if (prefill) {
    prefillData = {
      email: prefill.email ?? null,
      company_name: prefill.company_name ?? null,
      contact_name: prefill.contact_name ?? null,
      phone: prefill.phone ?? null,
      industries: prefill.industries ?? [],
    }
  }

  const insertPayload: Record<string, any> = {
    token,
    ae_id: caller.id,
    ...prefillData,
  }

  // If client_id provided, also store in a dedicated column if exists (fallback to created_client_id for tracking)
  // We use a JSON column or just keep in company_name etc. For future, we store linked client id in review_notes as JSON
  // But we also try to insert into a column client_id if migration added it – ignore error if column missing
  // So we attempt with client_id, and fallback without

  let row: any = null
  let error: any = null

  // Try insert with client_id column (new flow)
  const tryPayloads = [
    { ...insertPayload, client_id: prefill?.client_id ?? null },
    insertPayload,
  ]

  for (const payload of tryPayloads) {
    const res = await admin
      .from("client_intake_submissions")
      .insert(payload)
      .select("expires_at")
      .single()
    if (!res.error) {
      row = res.data
      error = null
      break
    }
    // If error is about missing column client_id, try next
    if (res.error?.message?.includes("client_id") || res.error?.code === "42703") {
      continue
    }
    error = res.error
    break
  }

  if (error) {
    return { ok: false, error: error.message }
  }

  try {
    await admin.from("activities").insert({
      opportunity_id: null,
      action_type: "client_intake_link_created",
      description: JSON.stringify({ token_prefix: token.slice(0, 8), prefill: !!prefillData.company_name, client_id: prefill?.client_id ?? null }),
      performed_by: caller.id,
    })
  } catch (auditErr) {
    console.error("[v0] createIntakeLink: audit log failed:", auditErr)
  }

  revalidatePath("/admin/clients/intake")

  return {
    ok: true,
    url: `${siteConfig.url}/client-intake/${token}`,
    expiresAt: row?.expires_at,
  }
}

// Helper for supplement flow after account creation – creates link tied to existing client
export async function createSupplementLinkForClient(clientId: string): Promise<CreateIntakeLinkResult> {
  return createIntakeLink({ client_id: clientId })
}
