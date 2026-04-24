"use server"

/**
 * Sprint D — Bulk lead import server actions.
 *
 * Two-phase flow:
 *   1. previewBulkImport(rawRows) — parse rows, run dedup vs. existing leads
 *      (by email AND company_name), and optionally call Apollo.io to enrich.
 *      Returns a preview so the admin can eyeball before committing.
 *   2. commitBulkImport(preview, clientId) — inserts new leads and creates
 *      one opportunity per new lead, assigned to the chosen client.
 */

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enrichPersonWithApollo, apolloConfigured } from "@/lib/enrich/apollo"
import { sendBuyerInquiryReceivedEmail } from "@/lib/buyers/confirmation-email"

const ALLOWED_ROLES = new Set([
  "admin",
  "staff",
  "super_admin",
  "lead_researcher",
  "account_executive",
])

export type RawImportRow = {
  companyName: string
  contactPerson?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  linkedinUrl?: string | null
  industry?: string | null
  country?: string | null
  website?: string | null
  notes?: string | null
}

export type PreviewRow = {
  idx: number
  raw: RawImportRow
  enriched: Partial<RawImportRow>
  status: "new" | "duplicate_email" | "duplicate_company" | "invalid"
  reason?: string
  existingLeadId?: string | null
}

export type PreviewResult = {
  ok: boolean
  rows: PreviewRow[]
  apolloAvailable: boolean
  stats: {
    total: number
    valid: number
    duplicates: number
    invalid: number
  }
  error?: "unauthorized"
}

async function checkRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single()
  if (!profile || !ALLOWED_ROLES.has(profile.role)) return null
  return { userId: user.id, role: profile.role }
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  return trimmed
}

function normalizeCompany(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function domainFromWebsite(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export async function previewBulkImport(
  rows: RawImportRow[],
  options: { enrich: boolean } = { enrich: false },
): Promise<PreviewResult> {
  const who = await checkRole()
  if (!who) {
    return {
      ok: false,
      rows: [],
      apolloAvailable: apolloConfigured(),
      stats: { total: 0, valid: 0, duplicates: 0, invalid: 0 },
      error: "unauthorized",
    }
  }

  const admin = createAdminClient()

  // Load existing leads once. For scale this should be a smarter fuzzy
  // search; for sprint-D this is fine for up to a few thousand leads.
  const { data: existing } = await admin
    .from("leads")
    .select("id, contact_email, company_name")

  const byEmail = new Map<string, string>()
  const byCompany = new Map<string, string>()
  for (const row of existing ?? []) {
    const e = normalizeEmail(row.contact_email)
    if (e) byEmail.set(e, row.id)
    if (row.company_name) byCompany.set(normalizeCompany(row.company_name), row.id)
  }

  const preview: PreviewRow[] = []
  let valid = 0
  let duplicates = 0
  let invalid = 0

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const companyName = raw.companyName?.trim() ?? ""
    if (!companyName) {
      invalid++
      preview.push({
        idx: i,
        raw,
        enriched: {},
        status: "invalid",
        reason: "missing_company_name",
      })
      continue
    }

    const normEmail = normalizeEmail(raw.contactEmail)
    const normCompany = normalizeCompany(companyName)

    // Optional Apollo enrichment.
    let enriched: Partial<RawImportRow> = {}
    if (options.enrich && apolloConfigured()) {
      const apollo = normEmail
        ? await enrichPersonWithApollo({ email: normEmail })
        : await enrichPersonWithApollo({
            firstName: raw.contactPerson?.split(" ")[0] ?? undefined,
            lastName:
              raw.contactPerson?.split(" ").slice(1).join(" ") || undefined,
            companyDomain: domainFromWebsite(raw.website) ?? undefined,
            companyName,
          })

      if (apollo) {
        // `??` and `||` cannot be chained without parentheses in TS. Compute
        // the Apollo fallback name up front, then fall back through `??` only.
        const apolloFullName =
          [apollo.firstName, apollo.lastName].filter(Boolean).join(" ").trim() ||
          null

        enriched = {
          contactEmail: raw.contactEmail ?? apollo.email,
          contactPerson: raw.contactPerson ?? apolloFullName,
          contactPhone: raw.contactPhone ?? apollo.phone,
          linkedinUrl: raw.linkedinUrl ?? apollo.linkedinUrl,
          industry: raw.industry ?? apollo.companyIndustry,
          country: raw.country ?? apollo.companyCountry,
          website: raw.website ?? apollo.companyWebsite,
        }
      }
    }

    const finalEmail = normalizeEmail(enriched.contactEmail ?? raw.contactEmail)

    if (finalEmail && byEmail.has(finalEmail)) {
      duplicates++
      preview.push({
        idx: i,
        raw,
        enriched,
        status: "duplicate_email",
        existingLeadId: byEmail.get(finalEmail) ?? null,
      })
      continue
    }
    if (byCompany.has(normCompany)) {
      duplicates++
      preview.push({
        idx: i,
        raw,
        enriched,
        status: "duplicate_company",
        existingLeadId: byCompany.get(normCompany) ?? null,
      })
      continue
    }

    // Register to prevent in-batch duplicates too.
    if (finalEmail) byEmail.set(finalEmail, "__in_batch")
    byCompany.set(normCompany, "__in_batch")

    valid++
    preview.push({ idx: i, raw, enriched, status: "new" })
  }

  return {
    ok: true,
    rows: preview,
    apolloAvailable: apolloConfigured(),
    stats: { total: rows.length, valid, duplicates, invalid },
  }
}

export type CommitInput = {
  clientId: string
  rows: PreviewRow[]
}

export async function commitBulkImport(input: CommitInput): Promise<
  | {
      ok: true
      leadsCreated: number
      opportunitiesCreated: number
      skipped: number
    }
  | { ok: false; error: "unauthorized" | "clientNotFound" | "dbFailed" }
> {
  const who = await checkRole()
  if (!who) return { ok: false, error: "unauthorized" }

  const admin = createAdminClient()

  const { data: client, error: clientErr } = await admin
    .from("profiles")
    .select("id, role, fda_registration_number, company_name")
    .eq("id", input.clientId)
    .eq("role", "client")
    .single()
  if (clientErr || !client) return { ok: false, error: "clientNotFound" }

  const toInsert = input.rows.filter((r) => r.status === "new")
  if (toInsert.length === 0) {
    return { ok: true, leadsCreated: 0, opportunitiesCreated: 0, skipped: 0 }
  }

  const payload = toInsert.map((r) => ({
    company_name: r.raw.companyName.trim(),
    contact_person:
      (r.enriched.contactPerson ?? r.raw.contactPerson)?.trim() || null,
    contact_email:
      normalizeEmail(r.enriched.contactEmail ?? r.raw.contactEmail),
    contact_phone:
      (r.enriched.contactPhone ?? r.raw.contactPhone)?.trim() || null,
    linkedin_url:
      (r.enriched.linkedinUrl ?? r.raw.linkedinUrl)?.trim() || null,
    industry: (r.enriched.industry ?? r.raw.industry)?.trim() || null,
    country: (r.enriched.country ?? r.raw.country)?.trim() || null,
    website: (r.enriched.website ?? r.raw.website)?.trim() || null,
    notes: r.raw.notes?.trim() || null,
    source: "bulk_import",
    created_by: who.userId,
  }))

  const { data: insertedLeads, error: insertErr } = await admin
    .from("leads")
    .insert(payload)
    .select("id")

  if (insertErr || !insertedLeads) {
    console.error("[v0] bulk leads insert failed", insertErr)
    return { ok: false, error: "dbFailed" }
  }

  // Create an opportunity per lead, assigned to the chosen client.
  const oppPayload = insertedLeads.map((l) => ({
    client_id: input.clientId,
    lead_id: l.id,
    stage: "new" as const,
  }))
  const { data: insertedOpps, error: oppErr } = await admin
    .from("opportunities")
    .insert(oppPayload)
    .select("id")
  if (oppErr) {
    console.error("[v0] bulk opportunities insert failed", oppErr)
  }

  // Log a single activity row summarizing the import.
  await admin.from("activities").insert({
    action_type: "bulk_lead_import",
    description: `Imported ${insertedLeads.length} leads → assigned to ${client.company_name ?? "client"}`,
    performed_by: who.userId,
  })

  // Fire buyer acknowledgement emails in parallel. Each call is independently
  // logged + dedup'd server-side, so Promise.allSettled gives us best-effort
  // fan-out without any one failure bringing down the import.
  await Promise.allSettled(
    insertedLeads.map((l) =>
      sendBuyerInquiryReceivedEmail(l.id, { sentBy: who.userId }),
    ),
  )

  revalidatePath("/admin/leads")
  revalidatePath("/admin/pipeline")

  return {
    ok: true,
    leadsCreated: insertedLeads.length,
    opportunitiesCreated: insertedOpps?.length ?? 0,
    skipped: input.rows.length - insertedLeads.length,
  }
}
