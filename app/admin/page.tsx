import { redirect } from "next/navigation"
import { Users, Target, TrendingUp, Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScopeBanner } from "@/components/admin/scope-banner"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { ownershipScopeFor, resolveAllowedClientIds } from "@/lib/auth/scope"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const { t, locale } = await getDictionary()

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId } = current
  const scope = ownershipScopeFor(role, userId)

  // For scoped users, resolve the allowed client_ids once and reuse on
  // every count below. An AE who manages zero clients sees zeroes — never
  // a mistakenly-global count.
  const allowedClientIds = await resolveAllowedClientIds(scope, admin)
  const noScope = allowedClientIds === null
  const empty = !noScope && allowedClientIds.length === 0

  // Helper: apply the scope filter to a count query if needed.
  const scopedCount = async (
    table: "profiles" | "leads" | "opportunities",
    extra?: (q: any) => any,
  ): Promise<number> => {
    if (empty) return 0
    let q = admin.from(table).select("*", { count: "exact", head: true })
    if (extra) q = extra(q)
    if (table === "profiles") {
      q = q.eq("role", "client")
      if (!noScope) q = q.eq("account_manager_id", scope.kind === "owned" ? scope.userId : "")
    } else if (table === "opportunities") {
      if (!noScope) q = q.in("client_id", allowedClientIds!)
    } else if (table === "leads") {
      // A "lead" (buyer) shows up if any opportunity in scope references it.
      if (!noScope) {
        const { data: leadIdRows } = await admin
          .from("opportunities")
          .select("lead_id")
          .in("client_id", allowedClientIds!)
        const leadIds = Array.from(
          new Set(
            (leadIdRows ?? [])
              .map((r: any) => r.lead_id)
              .filter((v: any): v is string => typeof v === "string"),
          ),
        )
        if (leadIds.length === 0) return 0
        q = q.in("id", leadIds)
      }
    }
    const { count } = await q
    return count ?? 0
  }

  // Stage counts: scoped to the AE's clients when applicable.
  let stageQ = admin.from("opportunities").select("stage")
  if (!noScope) {
    if (allowedClientIds!.length === 0) {
      stageQ = stageQ.eq("client_id", "00000000-0000-0000-0000-000000000000") // forces empty
    } else {
      stageQ = stageQ.in("client_id", allowedClientIds!)
    }
  }

  const [clientCount, leadCount, oppCount, { data: stageCounts }] = await Promise.all([
    scopedCount("profiles"),
    scopedCount("leads"),
    scopedCount("opportunities"),
    stageQ,
  ])

  const won = stageCounts?.filter((o: { stage: string }) => o.stage === "won").length ?? 0
  const total = oppCount ?? 0
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0

  const stats = [
    { label: t.admin.dashboard.totalClients, value: clientCount, icon: Users, color: "text-primary" },
    { label: t.admin.dashboard.activeLeads, value: leadCount, icon: Target, color: "text-accent" },
    { label: t.admin.dashboard.pipelineValue, value: total, icon: TrendingUp, color: "text-chart-1" },
    { label: t.admin.dashboard.wonDeals, value: `${winRate}%`, icon: Trophy, color: "text-chart-4" },
  ]

  const stageData = (
    [
      "new",
      "contacted",
      "sample_requested",
      "sample_sent",
      "negotiation",
      "price_agreed",
      "production",
      "shipped",
      "won",
      "lost",
    ] as const
  ).map((key) => ({
    stage: key,
    label: t.kanban.stages[key],
    count: stageCounts?.filter((o: { stage: string }) => o.stage === key).length ?? 0,
  }))

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">{t.admin.dashboard.subtitle}</p>
        {scope.kind === "owned" && (
          <ScopeBanner
            locale={locale}
            count={clientCount}
            entityVi="khách hàng"
            entityEn="clients"
          />
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline stage breakdown */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t.admin.dashboard.stageDistribution}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t.admin.dashboard.stageDistributionDesc}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {stageData.map(({ stage, label, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted-foreground shrink-0">{label}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-medium text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
