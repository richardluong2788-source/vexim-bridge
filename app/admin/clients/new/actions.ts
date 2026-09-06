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
  phone?: string | null
  /**
   * Country the client (supplier) company is based in. Free text — feeds
   * calculateCountryMatch() in lib/matching/scorer.ts so AE auto-assignment
   * can compare against a buyer's country.
   */
  country?: string | null
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
  const fdaNumber = input.fda_registration_number?.trim() || null

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

  // Determine if caller is an AE (for auto-assignment)
  const isAE = callerProfile.role === "account_executive"

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
        fda_expires_at: fdaExpiresAt,
        // Auto-assign AE as account manager when they create the client
        account_manager_id: isAE ? caller.id : null,
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

  // ---- 5. Audit trail -------------------------------------------------------
  await admin.from("activities").insert({
    user_id: caller.id,
    action: "client_created",
    details: {
      new_client_id: newUserId,
      email,
      company_name: company,
      industries,
      primary_industry: industries[0],
      has_fda: !!fdaNumber,
      auto_assigned_ae: isAE ? caller.id : null,
      created_by_role: callerProfile.role,
    },
  })

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
 * Admin/AE-only: generate a single-use public intake link
 * (/client-intake/[token]) that a prospective client can fill in without
 * logging in. The row lives in `client_intake_submissions` — fully
 * decoupled from `profiles` — until an AE reviews and approves it in
 * "Hồ sơ chờ duyệt".
 */
export async function createIntakeLink(): Promise<CreateIntakeLinkResult> {
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

  const allowedRoles = ["admin", "staff", "super_admin", "account_executive"]
  if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const token = randomBytes(24).toString("base64url")
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from("client_intake_submissions")
    .insert({ token, ae_id: caller.id })
    .select("expires_at")
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  await admin.from("activities").insert({
    user_id: caller.id,
    action: "client_intake_link_created",
    details: { token_prefix: token.slice(0, 8) },
  })

  revalidatePath("/admin/clients/intake")

  return {
    ok: true,
    url: `${siteConfig.url}/client-intake/${token}`,
    expiresAt: row?.expires_at,
  }
}
