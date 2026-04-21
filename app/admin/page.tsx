import { createClient } from "@/lib/supabase/server"
import { Users, Target, TrendingUp, Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDictionary } from "@/lib/i18n/server"

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { t } = await getDictionary()

  const [
    { count: clientCount },
    { count: leadCount },
    { count: oppCount },
    { data: stageCounts },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("opportunities").select("*", { count: "exact", head: true }),
    supabase.from("opportunities").select("stage"),
  ])

  const won = stageCounts?.filter((o) => o.stage === "won").length ?? 0
  const total = oppCount ?? 0
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0

  const stats = [
    { label: t.admin.dashboard.totalClients, value: clientCount ?? 0, icon: Users, color: "text-primary" },
    { label: t.admin.dashboard.activeLeads, value: leadCount ?? 0, icon: Target, color: "text-accent" },
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
    count: stageCounts?.filter((o) => o.stage === key).length ?? 0,
  }))

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.admin.dashboard.subtitle}</p>
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
