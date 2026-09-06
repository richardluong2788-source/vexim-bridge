import Link from "next/link"
import { redirect } from "next/navigation"
import { PlusCircle, Sparkles } from "lucide-react"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { ownershipScopeFor } from "@/lib/auth/scope"
import { Button } from "@/components/ui/button"
import { BuyersTable, type BuyerRow } from "@/components/admin/buyers-table"
import { ScopeBanner } from "@/components/admin/scope-banner"
import type { Stage } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function BuyersDirectoryPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.BUYER_VIEW)) redirect("/admin")

  const { locale } = await getDictionary()
  const canViewPII = can(current.role, CAPS.BUYER_PII_VIEW)
  const scope = ownershipScopeFor(current.role, current.userId)
  const role = current.role

  // Business logic per role:
  // - LR: Can CREATE/IMPORT buyers, sees ALL buyers in pool, can trigger AI Match
  // - AE: CANNOT create buyers, only sees buyers ASSIGNED to them via opportunities
  // - Admin/SuperAdmin: Full access
  const isLR = role === "lead_researcher"
  const isAE = role === "account_executive" || role === "staff"
  const isAdmin = can(role, CAPS.OWNERSHIP_BYPASS)
  // Supplier Researchers have OWNERSHIP_BYPASS (they must see the whole
  // buyer pool for demand-driven sourcing) but must stay READ-ONLY on the
  // buyer side — creating/editing buyers and running AI matching is LR /
  // admin territory.
  const isSR = role === "supplier_researcher"

  // LR can write (create/import) buyers; AE cannot
  const canWriteBuyer = (isLR || isAdmin) && !isSR
  // LR and Admin can trigger AI matching for buyers
  const canRunMatch = (isLR || isAdmin) && !isSR

  // Scope logic:
  // - AE: Only see buyers assigned to them via opportunities
  // - LR: See ALL buyers in the pool (per business requirement)
  // - Admin: See all
  let allowedLeadIds: string[] | null = null
  if (isAE) {
    // AE: restricted to buyers they have opportunities with
    const { data: oppLeadRows } = await current.admin
      .from("opportunities")
      .select("lead_id")
      .eq("account_manager_id", current.userId)
    allowedLeadIds = Array.from(
      new Set(
        (oppLeadRows ?? [])
          .map((r: any) => r.lead_id)
          .filter((v: any): v is string => typeof v === "string"),
      ),
    )
  }
  // LR and Admin see all buyers (allowedLeadIds stays null)

  // One-shot read: buyer + every opportunity attached to it.
  // We join the minimum client fields needed for the "latest client" chip
  // so the admin can see who is currently working this buyer.
  // Also fetch AE assignment from ae_match_scores
  let buyersQ = current.admin
    .from("leads")
    .select(`
      id,
      company_name,
      contact_person,
      contact_email,
      contact_phone,
      country,
      industry,
      website,
      linkedin_url,
      created_at,
      priority_rating,
      main_product,
      hs_code,
      opportunities:opportunities (
        id,
        stage,
        last_updated,
        potential_value,
        account_manager_id,
        profiles:client_id ( id, full_name, company_name )
      ),
      ae_match_scores:ae_match_scores (
        account_manager_id,
        total_score,
        assignment_source,
        assigned_at,
        profiles:account_manager_id ( id, full_name )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500)
  if (allowedLeadIds !== null) {
    if (allowedLeadIds.length === 0) {
      // Sentinel UUID guarantees an empty result without short-circuiting
      // the rest of the page render.
      buyersQ = buyersQ.eq("id", "00000000-0000-0000-0000-000000000000")
    } else {
      buyersQ = buyersQ.in("id", allowedLeadIds)
    }
  }
  const { data: buyers } = await buyersQ

  const rows: BuyerRow[] = (buyers ?? []).map((b: any) => {
    const allOpps: Array<{
      id: string
      stage: Stage
      last_updated: string | null
      potential_value: number | null
      account_manager_id: string | null
      profiles: { id: string; full_name: string | null; company_name: string | null } | null
    }> = b.opportunities ?? []
    // For scoped users, hide any opportunities that don't belong to them.
    // This prevents the "latest client" chip and counts from leaking other
    // AEs' work via a buyer they happen to share.
    const opps =
      scope.kind === "owned"
        ? allOpps.filter((o) => o.account_manager_id === scope.userId)
        : allOpps

    // Sort opportunities by most recent activity so the "latest" is always
    // the one the user wants to see.
    const sorted = [...opps].sort((a, b) => {
      const ta = a.last_updated ? new Date(a.last_updated).getTime() : 0
      const tb = b.last_updated ? new Date(b.last_updated).getTime() : 0
      return tb - ta
    })
    const latest = sorted[0] ?? null

    // "Open" = any stage that is not won/lost. Used as the live pipeline
    // count; won/lost still count toward lifetime totals below.
    const openCount = opps.filter((o) => o.stage !== "won" && o.stage !== "lost").length
    const wonCount = opps.filter((o) => o.stage === "won").length

    // Get assigned AE from ae_match_scores (the one with assignment_source set)
    const aeScores = b.ae_match_scores ?? []
    const assignedScore = aeScores.find((s: any) => s.assignment_source !== null)
    const assignedAE = assignedScore?.profiles
      ? { id: assignedScore.profiles.id, name: assignedScore.profiles.full_name ?? "—" }
      : null

    return {
      id: b.id,
      company_name: b.company_name,
      contact_person: b.contact_person,
      contact_email: b.contact_email,
      contact_phone: b.contact_phone,
      country: b.country,
      industry: b.industry,
      website: b.website,
      linkedin_url: b.linkedin_url,
      created_at: b.created_at,
      priority_rating: b.priority_rating ?? null,
      main_product: b.main_product ?? null,
      hs_code: b.hs_code ?? null,
      totalOpportunities: opps.length,
      openOpportunities: openCount,
      wonOpportunities: wonCount,
      latestStage: latest?.stage ?? null,
      latestClient: latest?.profiles
        ? {
            id: latest.profiles.id,
            name: latest.profiles.company_name ?? latest.profiles.full_name ?? "—",
          }
        : null,
      latestUpdated: latest?.last_updated ?? null,
      assignedAE,
    }
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground text-balance">
            {locale === "vi" ? "Danh sách Buyer" : "Buyer Directory"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl text-pretty">
            {locale === "vi"
              ? "Tất cả người mua nước ngoài đã được thu thập. Tái sử dụng buyer có sẵn khi giao cho một client Việt Nam mới — tránh nhập trùng và giữ lịch sử đàm phán."
              : "Every foreign buyer captured so far. Re-use an existing buyer when assigning to a new Vietnamese client — prevents duplicates and preserves negotiation history."}
          </p>
          {isAE && (
            <ScopeBanner
              locale={locale}
              count={rows.length}
              entityVi="buyer"
              entityEn="buyers"
            />
          )}
          {isLR && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {locale === "vi"
                ? `Bạn có thể xem tất cả ${rows.length} buyer trong pool và chạy AI Match để gợi ý AE phù hợp.`
                : `You can view all ${rows.length} buyers in pool and run AI Match to suggest suitable AEs.`}
            </p>
          )}
        </div>
        {canWriteBuyer && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/buyers/import-importyeti">
                <Sparkles className="mr-2 h-4 w-4" />
                {locale === "vi" ? "Import từ ImportYeti" : "Import from ImportYeti"}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/leads/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                {locale === "vi" ? "Thêm Buyer" : "Add buyer"}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <BuyersTable rows={rows} locale={locale} canViewPII={canViewPII} canRunMatch={canRunMatch} isLeadResearcher={isLR} canWriteBuyer={canWriteBuyer} />
    </div>
  )
}
