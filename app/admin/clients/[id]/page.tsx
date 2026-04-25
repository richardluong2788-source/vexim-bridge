import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, Mail, Briefcase, Star, TrendingUp, Package, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FdaEditDialog } from "@/components/admin/fda-edit-dialog"
import { ClientComplianceWorkspace } from "@/components/admin/client-compliance-workspace"
import { AdminClientProductsManager } from "@/components/admin/admin-client-products-manager"
import { ClientPerformanceCard } from "@/components/admin/analytics/client-performance-card"
import { getFdaStatus, formatFdaDate } from "@/lib/fda/status"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, canAny } from "@/lib/auth/permissions"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ perfPeriod?: string }>
}

export default async function AdminClientDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const { t, locale } = await getDictionary()

  // Decide whether to show the analytics performance card. AE/Researcher
  // are only allowed to see analytics for clients they own — checked here
  // to avoid leaking deal counts of unrelated clients.
  const current = await getCurrentRole()
  const canSeeAnalytics =
    !!current && canAny(current.role, [CAPS.ANALYTICS_VIEW_ALL, CAPS.ANALYTICS_VIEW_OWN])

  // Fetch profile, docs, and tokenized links in parallel — they're independent.
  const [{ data: client }, { data: docs }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase
      .from("compliance_docs")
      .select("*")
      .eq("owner_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tokenized_share_links")
      .select("*")
      .eq("owner_id", id)
      .order("created_at", { ascending: false }),
  ])

  if (!client || client.role !== "client") return notFound()

  // Resolve bundle-link membership: for every link where doc_id IS NULL
  // (migration 022), pull the join rows so the UI can display which docs
  // are inside each bundle. Single-doc links keep their scalar doc_id.
  const bundleTokens = (links ?? [])
    .filter((l) => !l.doc_id)
    .map((l) => l.token)

  let bundleMembership: Record<string, string[]> = {}
  if (bundleTokens.length > 0) {
    const { data: joinRows } = await supabase
      .from("tokenized_share_link_docs")
      .select("token, doc_id, position")
      .in("token", bundleTokens)
      .order("position", { ascending: true })

    bundleMembership = (joinRows ?? []).reduce<Record<string, string[]>>(
      (acc, row) => {
        ;(acc[row.token] ??= []).push(row.doc_id)
        return acc
      },
      {},
    )
  }

  // Collapse into a single array the workspace component can consume.
  const linksWithDocs = (links ?? []).map((l) => ({
    ...l,
    doc_ids: l.doc_id ? [l.doc_id] : (bundleMembership[l.token] ?? []),
  }))

  const fdaInfo = getFdaStatus(client.fda_expires_at)
  const companyLabel = client.company_name ?? client.full_name ?? client.email ?? "—"
  const s = t.admin.clients

  return (
    <div className="flex flex-col gap-6 p-8 max-w-5xl mx-auto">
      {/* Breadcrumb / back */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/clients">
            <ArrowLeft className="h-4 w-4" />
            {s.backToList}
          </Link>
        </Button>
      </div>

      {/* Header card */}
      <Card className="border-border">
        <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground text-pretty">
                {companyLabel}
              </h1>
              {(() => {
                const list =
                  client.industries && client.industries.length > 0
                    ? client.industries
                    : client.industry
                      ? [client.industry]
                      : []
                if (list.length === 0) return null
                const [primary, ...rest] = list
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1 font-normal">
                      {rest.length > 0 ? (
                        <Star
                          className="h-3 w-3 fill-current"
                          aria-label="Primary industry"
                        />
                      ) : (
                        <Briefcase className="h-3 w-3" />
                      )}
                      {primary}
                    </Badge>
                    {rest.map((ind) => (
                      <Badge
                        key={ind}
                        variant="outline"
                        className="font-normal"
                      >
                        {ind}
                      </Badge>
                    ))}
                  </div>
                )
              })()}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {client.email ?? "—"}
              {client.full_name && client.company_name && (
                <span className="text-muted-foreground/70 ml-1">· {client.full_name}</span>
              )}
            </p>

            {/* FDA at-a-glance */}
            <div className="flex items-center gap-3 flex-wrap mt-2">
              {client.fda_registration_number ? (
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">{s.fdaRegistration}</p>
                  <p className="font-mono text-sm text-foreground">
                    {client.fda_registration_number}
                  </p>
                  {client.fda_expires_at && (
                    <p
                      className={
                        fdaInfo.status === "expired"
                          ? "text-xs text-destructive font-medium"
                          : fdaInfo.status === "expiring_soon"
                            ? "text-xs text-amber-600 dark:text-amber-400 font-medium"
                            : "text-xs text-muted-foreground"
                      }
                    >
                      {fdaInfo.status === "expired"
                        ? s.fdaExpired.replace(
                            "{date}",
                            formatFdaDate(client.fda_expires_at, locale),
                          )
                        : s.fdaExpiresOn.replace(
                            "{date}",
                            formatFdaDate(client.fda_expires_at, locale),
                          )}
                    </p>
                  )}
                </div>
              ) : (
                <Badge variant="destructive" className="font-normal">
                  {s.nonCompliant}
                </Badge>
              )}

              <FdaEditDialog
                client={{
                  id: client.id,
                  full_name: client.full_name,
                  company_name: client.company_name,
                  fda_registration_number: client.fda_registration_number,
                  fda_registered_at: client.fda_registered_at,
                  fda_expires_at: client.fda_expires_at,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed content: Performance / Products / Compliance.
          Tabs is a Client Component but accepts server-rendered children via
          React's RSC boundary, so the data-fetching inside <ClientPerformanceCard />
          (an async server component) still runs on the server. */}
      {(() => {
        const showPerf =
          canSeeAnalytics &&
          (canAny(current!.role, [CAPS.ANALYTICS_VIEW_ALL]) ||
            client.account_manager_id === current!.userId)
        const defaultTab = showPerf ? "performance" : "products"
        const tabsCopy = (s as any).tabs ?? {
          performance: "Performance",
          products: "Products",
          compliance: "Compliance",
        }

        return (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
              {showPerf && (
                <TabsTrigger value="performance" className="gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tabsCopy.performance}</span>
                  <span className="sm:hidden">{tabsCopy.performance}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="products" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {tabsCopy.products}
              </TabsTrigger>
              <TabsTrigger value="compliance" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                {tabsCopy.compliance}
              </TabsTrigger>
            </TabsList>

            {showPerf && (
              <TabsContent value="performance" className="mt-4">
                <ClientPerformanceCard
                  clientId={client.id}
                  perfPeriodRaw={sp.perfPeriod}
                  basePath={`/admin/clients/${client.id}`}
                />
              </TabsContent>
            )}

            <TabsContent value="products" className="mt-4">
              <AdminClientProductsManager
                clientId={client.id}
                clientName={companyLabel}
              />
            </TabsContent>

            <TabsContent value="compliance" className="mt-4">
              <ClientComplianceWorkspace
                clientId={client.id}
                clientName={companyLabel}
                initialDocs={docs ?? []}
                initialLinks={linksWithDocs}
              />
            </TabsContent>
          </Tabs>
        )
      })()}
    </div>
  )
}
