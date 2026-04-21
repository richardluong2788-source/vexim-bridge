import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, Mail, Briefcase, Star } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FdaEditDialog } from "@/components/admin/fda-edit-dialog"
import { ClientComplianceWorkspace } from "@/components/admin/client-compliance-workspace"
import { getFdaStatus, formatFdaDate } from "@/lib/fda/status"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { t, locale } = await getDictionary()

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

      {/* Compliance workspace */}
      <ClientComplianceWorkspace
        clientId={client.id}
        clientName={companyLabel}
        initialDocs={docs ?? []}
        initialLinks={links ?? []}
      />
    </div>
  )
}
