import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Target,
  TrendingUp,
  Trophy,
  Clock,
  AlertTriangle,
  Lock,
  HandCoins,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getDictionary } from "@/lib/i18n/server"
import { ClientCommissionTimeline } from "@/components/client/client-commission-timeline"

const STAGE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "secondary",
  contacted: "outline",
  sample_requested: "outline",
  sample_sent: "outline",
  negotiation: "outline",
  price_agreed: "outline",
  production: "outline",
  shipped: "default",
  won: "default",
  lost: "destructive",
  quoted: "outline",
}

export default async function ClientDashboardPage() {
  const supabase = await createClient()
  const { t, locale } = await getDictionary()
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single()

  // R-07 — read through the masked view, NOT the raw leads table.
  // The DB-level view withholds contact_email/phone/person/website/linkedin
  // until the stage is shipped or won, so F12 on the network tab cannot
  // leak buyer PII during pre-commit stages.
  const { data: opportunities } = await supabase
    .from("client_leads_masked")
    .select(
      `opportunity_id, stage, last_updated, buyer_code,
       company_name, industry, region, website, linkedin_url,
       contact_person, contact_email, contact_phone, disclosure_level`,
    )
    .eq("client_id", user!.id)
    .order("last_updated", { ascending: false })

  // Sprint D — commission timeline: rely on RLS via the view's SECURITY INVOKER.
  const { data: timeline } = await supabase
    .from("client_commission_timeline")
    .select("paid_on, commission_amount, invoice_value")
    .eq("client_id", user!.id)
    .order("paid_on", { ascending: true })

  const total = opportunities?.length ?? 0
  const won = opportunities?.filter((o) => o.stage === "won").length ?? 0
  const inProgress =
    opportunities?.filter((o) => !["won", "lost"].includes(o.stage)).length ?? 0
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0

  // Total commission paid TO VXB (i.e. what this client has paid the VXB team).
  const totalCommissionPaid = (timeline ?? []).reduce(
    (acc, row) => acc + Number(row.commission_amount ?? 0),
    0,
  )

  const recentOpps = opportunities?.slice(0, 5) ?? []
  const isCompliant = !!profile?.fda_registration_number

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t.client.dashboard.welcome}, {profile?.company_name ?? profile?.full_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t.client.dashboard.subtitle}</p>
        </div>
      </div>

      {/* Compliance warning */}
      {!isCompliant && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {t.client.dashboard.complianceWarningTitle}
            </p>
            <p className="text-sm text-destructive/80 mt-0.5 text-pretty">
              {t.client.dashboard.complianceWarningDesc}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards — 4 stage KPIs + dedicated commission card */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: t.client.dashboard.totalLeads, value: total, icon: Target, color: "text-primary" },
          {
            label: t.client.dashboard.inProgress,
            value: inProgress,
            icon: TrendingUp,
            color: "text-accent",
          },
          { label: t.client.dashboard.wonDeals, value: won, icon: Trophy, color: "text-chart-4" },
          { label: t.client.dashboard.winRate, value: `${winRate}%`, icon: Clock, color: "text-chart-3" },
        ].map(({ label, value, icon: Icon, color }) => (
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

        {/* Sprint D — commission paid to VXB card */}
        <Card className="border-primary/30 bg-primary/5 col-span-2 lg:col-span-1">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.client.dashboard.commissionCard.label}
            </CardTitle>
            <HandCoins className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(totalCommissionPaid)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              {t.client.dashboard.commissionCard.sublabel.replace(
                "{n}",
                String(timeline?.length ?? 0),
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sprint D — cumulative revenue / commission chart */}
      <ClientCommissionTimeline
        points={(timeline ?? []).map((r) => ({
          paid_on: String(r.paid_on),
          commission_amount: Number(r.commission_amount ?? 0),
          invoice_value: Number(r.invoice_value ?? 0),
        }))}
        locale={dateLocale}
      />

      {/* Recent opportunities */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold">{t.client.dashboard.recentLeads}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{t.client.dashboard.recentLeadsDesc}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/client/leads">{t.client.dashboard.viewAll}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOpps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 text-pretty">
              {t.client.dashboard.emptyDesc}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentOpps.map((opp) => {
                // The view already pre-masks — company_name is NULL before
                // price_agreed, contact fields are NULL before shipped.
                const displayName = opp.company_name ?? opp.buyer_code ?? "—"
                const level = (opp.disclosure_level as 1 | 2 | 3) ?? 1

                return (
                  <div
                    key={opp.opportunity_id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {level === 1 && (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                      )}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[opp.industry, opp.region].filter(Boolean).join(" · ")}
                          {opp.industry || opp.region ? " · " : ""}
                          {t.client.dashboard.updated}{" "}
                          {new Date(opp.last_updated).toLocaleDateString(dateLocale, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <Badge variant={STAGE_VARIANTS[opp.stage] ?? "secondary"}>
                      {t.kanban.stages[opp.stage as keyof typeof t.kanban.stages] ?? opp.stage}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
