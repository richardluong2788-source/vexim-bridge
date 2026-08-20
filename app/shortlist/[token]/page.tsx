/**
 * Public tokenized shortlist page.
 *
 * A buyer who answered the AE's requirement-gathering email receives a link
 * like `https://esh.example/shortlist/<uuid-token>` and can view the 3-5
 * AI-matched supplier profiles the AE picked for them — without
 * authenticating. The token itself is the authorization bearer, same
 * pattern as `/share/[token]` for compliance docs.
 *
 * The buyer can mark which supplier(s) they're interested in directly on
 * this page. That flips `buyer_engagement_shortlist.buyer_interested` and
 * advances the engagement to `buyer_responded`, which is what surfaces the
 * "Gán client" (assign client) action back in the AE's Inbox.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { ShieldAlert, Clock, Building2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InterestButton } from "./interest-button"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ token: string }>
}

type ClientProfileSummary = {
  client_id: string
  slug: string
  display_name: string | null
  tagline: string | null
  logo_url: string | null
  cover_image_url: string | null
  moq: string | null
  lead_time_days: string | null
  usp_points: { icon?: string; title: string }[] | null
}

type ShortlistRow = {
  id: string
  client_id: string
  position: number
  buyer_interested: boolean | null
}

function one<T>(rel: T | T[] | null): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

export default async function ShortlistTokenPage({ params }: PageProps) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from("shortlist_share_links")
    .select("token, engagement_id, expires_at, revoked_at, view_count")
    .eq("token", token)
    .maybeSingle()

  if (!link) {
    return (
      <ErrorScreen
        title="Liên kết không hợp lệ"
        desc="Đường link này không tồn tại hoặc đã bị xóa. Vui lòng liên hệ lại người phụ trách để nhận link mới."
      />
    )
  }
  if (link.revoked_at) {
    return (
      <ErrorScreen
        title="Liên kết đã bị hủy"
        desc="Đường link này không còn khả dụng. Vui lòng liên hệ lại người phụ trách để nhận link mới."
      />
    )
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return (
      <ErrorScreen
        title="Liên kết đã hết hạn"
        desc="Đường link này đã hết hạn. Vui lòng liên hệ lại người phụ trách để nhận link mới."
      />
    )
  }

  const { data: engagement } = await admin
    .from("buyer_engagements")
    .select("id, stage, account_manager_id, leads (company_name, contact_person)")
    .eq("id", link.engagement_id)
    .maybeSingle()

  if (!engagement) {
    return (
      <ErrorScreen
        title="Không tìm thấy dữ liệu"
        desc="Không tìm thấy thông tin liên quan đến đường link này."
      />
    )
  }

  const { data: rows } = await admin
    .from("buyer_engagement_shortlist")
    .select("id, client_id, position, buyer_interested")
    .eq("engagement_id", link.engagement_id)
    .order("position", { ascending: true })

  const suppliers = (rows ?? []) as ShortlistRow[]
  const clientIds = suppliers.map((s) => s.client_id)

  const [{ data: profileRows }, { data: clientProfileRows }] = await Promise.all([
    clientIds.length
      ? admin.from("profiles").select("id, company_name, full_name").in("id", clientIds)
      : Promise.resolve({ data: [] as any[] }),
    clientIds.length
      ? admin
          .from("client_profiles")
          .select(
            "client_id, slug, display_name, tagline, logo_url, cover_image_url, moq, lead_time_days, usp_points",
          )
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const profileById = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p as { company_name: string | null; full_name: string | null }]),
  )
  const clientProfileByClientId = new Map(
    (clientProfileRows ?? []).map((cp) => [cp.client_id as string, cp as ClientProfileSummary]),
  )

  // Best-effort telemetry + stage advance — never blocks rendering.
  await admin
    .from("shortlist_share_links")
    .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("token", token)

  if (engagement.stage === "shortlist_sent") {
    await admin
      .from("buyer_engagements")
      .update({ stage: "buyer_viewed" })
      .eq("id", engagement.id)
  }

  const lead = one(engagement.leads as any)
  const buyerCompany = lead?.company_name ?? "your company"

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col overflow-x-hidden">
      <header className="bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Vexim Trade</span>
              <span className="text-xs text-muted-foreground">Supplier shortlist for {buyerCompany}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Expires {new Date(link.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-foreground text-balance">
              We&apos;ve shortlisted {suppliers.length} suppliers for you
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Based on the requirements you shared, our team reviewed your product needs and matched
              you with the suppliers below. Open each profile to review their capabilities, then let
              us know which one(s) you&apos;d like to move forward with.
            </p>
          </div>

          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppliers have been added to this shortlist yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers.map((s, idx) => {
                const profile = clientProfileByClientId.get(s.client_id) ?? null
                const p = profileById.get(s.client_id) ?? null
                const name = profile?.display_name || p?.company_name || p?.full_name || "Supplier"
                const usp = (profile?.usp_points ?? []).slice(0, 2)

                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden">
                          {profile?.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={profile.logo_url || "/placeholder.svg"}
                              alt={name}
                              className="h-full w-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                          {profile?.tagline && (
                            <p className="text-xs text-muted-foreground truncate">{profile.tagline}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        #{idx + 1}
                      </Badge>
                    </div>

                    {(profile?.moq || profile?.lead_time_days) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {profile?.moq && <span>MOQ: {profile.moq}</span>}
                        {profile?.lead_time_days && <span>Lead time: {profile.lead_time_days}</span>}
                      </div>
                    )}

                    {usp.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {usp.map((u, i) => (
                          <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                            <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                            {u.title}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center gap-2 pt-1 mt-auto">
                      {profile?.slug && (
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <a href={`/profile/${profile.slug}`} target="_blank" rel="noopener noreferrer">
                            View profile
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <InterestButton
                        token={token}
                        shortlistId={s.id}
                        initialInterested={s.buyer_interested}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 text-xs text-muted-foreground">
          This link was sent to you by your Vexim Trade account manager and is not publicly searchable.
        </div>
      </footer>
    </div>
  )
}

function ErrorScreen({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
      <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground text-balance">{title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{desc}</p>
      </div>
    </div>
  )
}
