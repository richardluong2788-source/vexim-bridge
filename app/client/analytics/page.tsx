import { redirect } from "next/navigation"
import { BarChart3, Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  parsePeriod,
  resolvePeriod,
} from "@/lib/analytics/constants"
import { getDictionary } from "@/lib/i18n/server"
import { isAdminShellRole, normaliseRole } from "@/lib/auth/permissions"
import { parseClientTab } from "@/lib/analytics/client-tabs"
import { ClientPeriodSelector } from "@/components/client/analytics/period-selector"
import { ClientAnalyticsTabsNav } from "@/components/client/analytics/tabs-nav"
import { ClientOverviewTab } from "@/components/client/analytics/overview-tab"
import { ClientPipelineTab } from "@/components/client/analytics/pipeline-tab"
import { ClientWinLossTab } from "@/components/client/analytics/win-loss-tab"
import { ClientFinancialTab } from "@/components/client/analytics/financial-tab"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ tab?: string; period?: string }>
}

export default async function ClientAnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const tab = parseClientTab(sp.tab)
  const periodValue = parsePeriod(sp.period)

  const { t, locale } = await getDictionary()
  const period = resolvePeriod(periodValue, locale)
  const a = t.client.analytics

  // Auth — defense in depth on top of /client layout's check.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const role = normaliseRole(profile?.role)
  if (isAdminShellRole(role)) redirect("/admin/analytics")

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-balance flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" aria-hidden="true" />
            {a.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-pretty max-w-2xl">
            {a.subtitle}
          </p>
        </div>
        <ClientPeriodSelector value={periodValue} />
      </div>

      {/* Privacy / methodology disclosure — shown once, top-of-page so the
          client always knows what the numbers do and don't represent. */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{a.privacyNoteTitle}</AlertTitle>
        <AlertDescription>{a.privacyNote}</AlertDescription>
      </Alert>

      {/* Tabs */}
      <ClientAnalyticsTabsNav current={tab} period={periodValue} />

      {/* Tab content */}
      {tab === "overview" && <ClientOverviewTab period={period} />}
      {tab === "pipeline" && <ClientPipelineTab />}
      {tab === "winloss" && <ClientWinLossTab period={period} />}
      {tab === "financial" && <ClientFinancialTab />}
    </div>
  )
}
