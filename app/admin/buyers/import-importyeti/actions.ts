"use server"

/**
 * Server actions for the ImportYeti buyer-import flow.
 *
 * Two-phase pattern, matching the existing CSV bulk importer:
 *   1. previewImportYeti(rawText)  — calls the AI parser, runs dedup vs
 *      existing buyers, returns a structured preview the admin can review.
 *   2. commitImportYetiPreview({ rows }) — inserts the new buyers into
 *      `leads` with source_platform='importyeti' + the customs metadata.
 *
 * IMPORTANT: this flow does NOT assign buyers to a Vietnamese client. These
 * are research-stage buyers — they sit in the directory until staff later
 * use the existing "Assign to client" action on /admin/buyers/[id].
 */

import { revalidatePath } from "next/cache"
import { requireCap } from "@/lib/auth/guard"
import { CAPS } from "@/lib/auth/permissions"
import {
  parseImportYetiText,
  ImportYetiParserError,
  type ImportYetiBuyer,
} from "@/lib/ai/importyeti-parser"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportYetiPreviewRow = {
  idx: number
  data: ImportYetiBuyer
  status: "new" | "duplicate_company"
  /** Set when status === "duplicate_company". Used by the UI to deep-link. */
  existingLeadId: string | null
}

export type PreviewResponse =
  | {
      ok: true
      rows: ImportYetiPreviewRow[]
      stats: {
        total: number
        newCount: number
        duplicateCount: number
        inputCharCount: number
      }
    }
  | {
      ok: false
      error:
        | "unauthorized"
        | "input_empty"
        | "input_too_long"
        | "ai_failed"
        | "no_buyers_found"
        | "db_failed"
      message?: string
    }

export type CommitResponse =
  | {
      ok: true
      created: number
      skipped: number
    }
  | {
      ok: false
      error: "unauthorized" | "db_failed" | "no_rows"
      message?: string
    }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCompany(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Build the row payload that goes into `leads`. Centralised so preview and
 * commit always agree on which fields are persisted.
 */
function rowToLeadPayload(
  buyer: ImportYetiBuyer,
  userId: string,
): Record<string, unknown> {
  return {
    company_name: buyer.companyName.trim(),
    country: buyer.country?.trim() || null,
    website: buyer.website?.trim() || null,

    // Customs metadata — these columns were added in migration 032.
    import_address: buyer.importAddress?.trim() || null,
    import_ports: buyer.importPorts?.length ? buyer.importPorts : null,
    hs_codes: buyer.hsCodes?.length ? buyer.hsCodes : null,
    product_keywords: buyer.productKeywords?.length
      ? buyer.productKeywords
      : null,
    customs_shipment_count: buyer.shipmentCount12mo ?? null,
    top_suppliers: buyer.topSuppliers?.length ? buyer.topSuppliers : null,
    source_ref: buyer.sourceRef?.trim() || null,
    customs_data_updated_at: new Date().toISOString(),

    // Provenance — let the directory filter "Buyers from ImportYeti".
    source: "importyeti",
    created_by: userId,
  }
}

// ---------------------------------------------------------------------------
// previewImportYeti
// ---------------------------------------------------------------------------

export async function previewImportYeti(
  rawText: string,
): Promise<PreviewResponse> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) {
    return { ok: false, error: "unauthorized" }
  }
  const { admin } = guard

  // 1) Run the AI parser. ImportYetiParserError carries a stable code we
  //    forward 1:1 to the UI so it can render localised error copy.
  let parsed: { buyers: ImportYetiBuyer[]; inputCharCount: number }
  try {
    parsed = await parseImportYetiText(rawText)
  } catch (err) {
    if (err instanceof ImportYetiParserError) {
      return { ok: false, error: err.code, message: err.message }
    }
    console.error("[v0] previewImportYeti unexpected error:", err)
    return { ok: false, error: "ai_failed", message: "Unexpected parser error" }
  }

  // 2) Pull every existing buyer's company name once so we can dedup in
  //    O(1) per parsed row. For >50k buyers this should move to a server-
  //    side fuzzy match — fine for current scale.
  const { data: existing, error: existingErr } = await admin
    .from("leads")
    .select("id, company_name")
  if (existingErr) {
    console.error("[v0] previewImportYeti existing fetch failed:", existingErr)
    return { ok: false, error: "db_failed", message: existingErr.message }
  }

  const byCompany = new Map<string, string>()
  for (const row of existing ?? []) {
    if (row.company_name) {
      byCompany.set(normalizeCompany(row.company_name), row.id)
    }
  }

  // 3) Mark each parsed buyer as "new" or "duplicate_company". Also
  //    register newly-seen names in the same map so two identical buyers
  //    in the same paste don't both pass through.
  const rows: ImportYetiPreviewRow[] = parsed.buyers.map((buyer, idx) => {
    const norm = normalizeCompany(buyer.companyName)
    const existingId = byCompany.get(norm)
    if (existingId) {
      return {
        idx,
        data: buyer,
        status: "duplicate_company",
        existingLeadId: existingId,
      }
    }
    byCompany.set(norm, "__in_batch")
    return { idx, data: buyer, status: "new", existingLeadId: null }
  })

  const newCount = rows.filter((r) => r.status === "new").length
  return {
    ok: true,
    rows,
    stats: {
      total: rows.length,
      newCount,
      duplicateCount: rows.length - newCount,
      inputCharCount: parsed.inputCharCount,
    },
  }
}

// ---------------------------------------------------------------------------
// commitImportYetiPreview
// ---------------------------------------------------------------------------

export async function commitImportYetiPreview(input: {
  rows: ImportYetiPreviewRow[]
}): Promise<CommitResponse> {
  const guard = await requireCap(CAPS.BUYER_WRITE)
  if (!guard.ok) return { ok: false, error: "unauthorized" }
  const { admin, userId } = guard

  const toInsert = input.rows.filter((r) => r.status === "new")
  if (toInsert.length === 0) {
    return { ok: false, error: "no_rows" }
  }

  const payload = toInsert.map((r) => rowToLeadPayload(r.data, userId))

  const { data: inserted, error: insertErr } = await admin
    .from("leads")
    .insert(payload)
    .select("id")

  if (insertErr || !inserted) {
    console.error("[v0] commitImportYetiPreview insert failed:", insertErr)
    return {
      ok: false,
      error: "db_failed",
      message: insertErr?.message ?? "insert returned no rows",
    }
  }

  // Best-effort audit row. We deliberately don't fail the import if this
  // write errors — the customer still got their buyers.
  await admin.from("activities").insert({
    action_type: "bulk_lead_import",
    description: `ImportYeti: parsed ${inserted.length} new buyer${inserted.length === 1 ? "" : "s"} via AI`,
    performed_by: userId,
  })

  revalidatePath("/admin/buyers")
  revalidatePath("/admin/leads")

  return {
    ok: true,
    created: inserted.length,
    skipped: input.rows.length - inserted.length,
  }
}
