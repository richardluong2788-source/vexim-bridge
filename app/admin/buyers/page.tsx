import Link from "next/link"
import { redirect } from "next/navigation"
import { PlusCircle, Sparkles, Upload } from "lucide-react"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { BuyersTable, type BuyerRow } from "@/components/admin/buyers-table"
import type { Stage } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function BuyersDirectoryPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.BUYER_VIEW)) redirect("/admin")

  const { locale } = await getDictionary()
  const canWrite = can(current.role, CAPS.BUYER_WRITE)
  const canViewPII = can(current.role, CAPS.BUYER_PII_VIEW)

  // One-shot read: buyer + every opportunity attached to it.
  // We join the minimum client fields needed for the "latest client" chip
  // so the admin can see who is currently working this buyer.
  const { data: buyers } = await current.admin
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
      opportunities:opportunities (
        id,
        stage,
        last_updated,
        potential_value,
        profiles:client_id ( id, full_name, company_name )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500)

  const rows: BuyerRow[] = (buyers ?? []).map((b: any) => {
    const opps: Array<{
      id: string
      stage: Stage
      last_updated: string | null
      potential_value: number | null
      profiles: { id: string; full_name: string | null; company_name: string | null } | null
    }> = b.opportunities ?? []

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
    }
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">
            {locale === "vi" ? "Danh sách Buyer" : "Buyer Directory"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl text-pretty">
            {locale === "vi"
              ? "Tất cả người mua nước ngoài đã được thu thập. Tái sử dụng buyer có sẵn khi giao cho một client Việt Nam mới — tránh nhập trùng và giữ lịch sử đàm phán."
              : "Every foreign buyer captured so far. Re-use an existing buyer when assigning to a new Vietnamese client — prevents duplicates and preserves negotiation history."}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/buyers/import-importyeti">
                <Sparkles className="mr-2 h-4 w-4" />
                {locale === "vi" ? "Import từ ImportYeti" : "Import from ImportYeti"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/leads/import">
                <Upload className="mr-2 h-4 w-4" />
                {locale === "vi" ? "Import hàng loạt" : "Bulk import"}
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

      <BuyersTable rows={rows} locale={locale} canViewPII={canViewPII} />
    </div>
  )
}
