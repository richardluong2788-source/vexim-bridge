"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"
import { siteConfig } from "@/lib/site-config"

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

  if (
    !callerProfile ||
    !["admin", "staff", "super_admin"].includes(callerProfile.role)
  ) {
    return { ok: false, error: "forbidden" }
  }

  // ---- 3. Provision auth user via service role ------------------------------
  const admin = createAdminClient()

  const { data: inviteData, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "client",
        full_name: fullName,
        company_name: company,
      },
      // IMPORTANT: point at the client-side /auth/accept-invite page,
      // NOT the server route /auth/callback.
      //
      // `admin.inviteUserByEmail` does not use PKCE, so Supabase returns
      // the session tokens in the URL hash fragment (`#access_token=...`).
      // Hash fragments are not sent to the server, so a Route Handler
      // cannot read them — they must be parsed client-side by the
      // Supabase browser client (which auto-detects `detectSessionInUrl`).
      //
      // This URL must also match an entry in Supabase Dashboard →
      // Authentication → URL Configuration → Redirect URLs, otherwise
      // Supabase silently falls back to "Site URL".
      redirectTo: `${siteConfig.url}/auth/accept-invite`,
    })

  if (inviteErr || !inviteData?.user) {
    const msg = inviteErr?.message ?? "invite_failed"
    if (/already/i.test(msg)) return { ok: false, error: "email_exists" }
    return { ok: false, error: msg }
  }

  const newUserId = inviteData.user.id

  // ---- 4. Upsert profile with business metadata -----------------------------
  // We write `industries` (the multi-value column). The BEFORE trigger
  // `profiles_sync_primary_industry` will set `industry = industries[1]`
  // automatically, so legacy reads (lead-card, kanban, clients-table, AI
  // email generator) keep working without code changes.
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
        fda_registration_number: fdaNumber,
        fda_expires_at: fdaExpiresAt,
      },
      { onConflict: "id" },
    )

  if (profileErr) {
    // Roll back auth user so admin can retry cleanly.
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: profileErr.message }
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
    },
  })

  revalidatePath("/admin/clients")
  revalidatePath("/admin/users")

  return {
    ok: true,
    userId: newUserId,
    inviteLink: null,
  }
}
