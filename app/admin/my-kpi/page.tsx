/**
 * /admin/my-kpi — Personal KPI dashboard for each role.
 *
 * Displays role-specific metrics:
 *   - AE: deals, revenue, win rate, ranking
 *   - LR: buyers imported, matched, conversion
 *   - Admin/Finance: team overview
 */
import { redirect } from "next/navigation"
import { Target } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { getDictionary } from "@/lib/i18n/server"
import { resolvePeriod, getAEKPIs, getLRKPIs, getTeamKPIs, type KPIPeriod } from "@/lib/kpi/queries"
import { KPIPeriodSelector } from "@/components/admin/kpi/period-selector"
import { AEKPIDashboard } from "@/components/admin/kpi/ae-dashboard"
import { LRKPIDashboard } from "@/components/admin/kpi/lr-dashboard"
import { TeamKPIDashboard } from "@/components/admin/kpi/team-dashboard"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

function parsePeriod(value?: string): KPIPeriod {
  if (value === "last_month" || value === "this_quarter" || value === "this_year") {
    return value
  }
  return "this_month"
}

export default async function MyKPIPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const periodValue = parsePeriod(sp.period)
  const period = resolvePeriod(periodValue)

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")

  // Supplier Researchers have no personal KPI dashboard yet — their working
  // view is the demand/supply board.
  if (current.role === "supplier_researcher") redirect("/admin/sourcing")

  const { locale } = await getDictionary()
  const role = current.role

  // Determine which dashboard to show
  const isAE = role === "account_executive"
  const isLR = role === "lead_researcher"
  const isAdmin = role === "admin" || role === "super_admin"
  const isFinance = role === "finance"

  // Fetch appropriate KPIs
  let aeKPIs = null
  let lrKPIs = null
  let teamKPIs = null

  if (isAE) {
    aeKPIs = await getAEKPIs(current.userId, period)
  } else if (isLR) {
    lrKPIs = await getLRKPIs(current.userId, period)
  } else if (isAdmin || isFinance) {
    teamKPIs = await getTeamKPIs(period)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-balance">
            <Target className="h-6 w-6 text-primary" />
            {locale === "vi" ? "KPI của tôi" : "My KPIs"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty">
            {locale === "vi"
              ? "Theo dõi hiệu suất cá nhân và tiến độ đạt mục tiêu."
              : "Track your personal performance and progress towards goals."}
          </p>
        </div>
        <KPIPeriodSelector value={periodValue} locale={locale} />
      </div>

      {/* Role-specific dashboard */}
      {isAE && aeKPIs && (
        <AEKPIDashboard kpis={aeKPIs} period={period} locale={locale} />
      )}
      {isLR && lrKPIs && (
        <LRKPIDashboard kpis={lrKPIs} period={period} locale={locale} />
      )}
      {(isAdmin || isFinance) && teamKPIs && (
        <TeamKPIDashboard kpis={teamKPIs} period={period} locale={locale} showFinance={isFinance} />
      )}
    </div>
  )
}
