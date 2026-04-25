/**
 * GET /api/export/clients — CSV download of every client visible to the
 * caller, including their assigned account manager and FDA status.
 *
 * Auth scope
 * ----------
 *   - ANALYTICS_VIEW_ALL → all clients
 *   - ANALYTICS_VIEW_OWN → only clients where account_manager_id = caller
 *   - Anyone else        → 403
 *
 * The CSV is intended to be opened in Excel; we write the BOM in
 * `lib/export/csv.ts` so Vietnamese diacritics survive the round-trip.
 */
import { NextResponse } from "next/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { toCsv, csvResponseHeaders, type CsvColumn } from "@/lib/export/csv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ClientRow {
  id: string
  email: string | null
  full_name: string | null
  company_name: string | null
  industry: string | null
  industries: string[] | null
  phone: string | null
  fda_registration_number: string | null
  fda_registered_at: string | null
  fda_expires_at: string | null
  account_manager_id: string | null
  created_at: string
}

export async function GET() {
  const current = await getCurrentRole()
  if (!current) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const seeAll = can(current.role, CAPS.ANALYTICS_VIEW_ALL)
  const seeOwn = can(current.role, CAPS.ANALYTICS_VIEW_OWN)
  if (!seeAll && !seeOwn) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { admin } = current

  // Fetch clients (scoped) + manager directory in parallel.
  let clientQuery = admin
    .from("profiles")
    .select(
      "id, email, full_name, company_name, industry, industries, phone, " +
        "fda_registration_number, fda_registered_at, fda_expires_at, " +
        "account_manager_id, created_at",
    )
    .eq("role", "client")
    .order("created_at", { ascending: false })

  if (!seeAll) {
    clientQuery = clientQuery.eq("account_manager_id", current.userId)
  }

  const [{ data: clients }, { data: staff }] = await Promise.all([
    clientQuery,
    admin
      .from("profiles")
      .select("id, full_name, email")
      .neq("role", "client"),
  ])

  const managerLabels: Record<string, string> = Object.fromEntries(
    (staff ?? []).map((s) => [
      s.id as string,
      ((s.full_name as string | null)?.trim() || (s.email as string | null) || "—"),
    ]),
  )

  const columns: CsvColumn<ClientRow>[] = [
    { header: "Company",                 value: (r) => r.company_name },
    { header: "Contact name",            value: (r) => r.full_name },
    { header: "Email",                   value: (r) => r.email },
    { header: "Phone",                   value: (r) => r.phone },
    {
      header: "Primary industry",
      value: (r) =>
        (r.industries && r.industries.length > 0
          ? r.industries[0]
          : r.industry) ?? "",
    },
    {
      header: "Other industries",
      value: (r) =>
        r.industries && r.industries.length > 1
          ? r.industries.slice(1).join(" | ")
          : "",
    },
    { header: "FDA number",              value: (r) => r.fda_registration_number },
    { header: "FDA registered at",       value: (r) => r.fda_registered_at },
    { header: "FDA expires at",          value: (r) => r.fda_expires_at },
    {
      header: "FDA compliant",
      value: (r) => {
        if (!r.fda_registration_number) return "no"
        if (!r.fda_expires_at) return "yes"
        return new Date(r.fda_expires_at).getTime() >= Date.now() ? "yes" : "expired"
      },
    },
    {
      header: "Account manager",
      value: (r) =>
        r.account_manager_id ? (managerLabels[r.account_manager_id] ?? "") : "",
    },
    { header: "Joined",                  value: (r) => r.created_at },
  ]

  const csv = toCsv((clients ?? []) as ClientRow[], columns)

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: csvResponseHeaders(`vexim-clients-${stamp}.csv`),
  })
}
