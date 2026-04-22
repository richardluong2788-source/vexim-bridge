/**
 * Public tokenized share page.
 *
 * A buyer receives a link like `https://esh.example/share/<uuid-token>` and
 * can view the associated compliance doc (factory video, price floor, etc.)
 * without authenticating — but only as long as:
 *   1. The token has NOT been revoked.
 *   2. `expires_at` is in the future.
 *
 * We increment `view_count` on every successful load and refresh
 * `last_viewed_at` so admins can audit engagement from the client workspace.
 *
 * This route is explicitly NOT protected by the admin middleware layer.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { getDictionary } from "@/lib/i18n/server"
import { ShieldAlert, Clock, Building2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { privateFileHref } from "@/lib/blob/file-url"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ token: string }>
}

// SOP §0.3 — admin-chosen kinds surfaceable over a public link. Anything
// else (FDA cert, COA) MUST stay gated behind auth.
const PUBLICLY_SHAREABLE = new Set([
  "factory_video",
  "factory_photo",
  "price_floor",
])

export default async function ShareTokenPage({ params }: PageProps) {
  const { token } = await params
  const { t, locale } = await getDictionary()
  const s = t.share

  // Admin client: we intentionally bypass RLS because the token IS the
  // authorization bearer here. The secret is the 128-bit UUID.
  const admin = createAdminClient()

  const { data: link } = await admin
    .from("tokenized_share_links")
    .select(
      "token, doc_id, owner_id, expires_at, revoked_at, view_count, compliance_docs:doc_id ( id, kind, title, url, mime_type, size_bytes, expires_at, notes ), profiles:owner_id ( company_name, full_name )",
    )
    .eq("token", token)
    .maybeSingle()

  if (!link) return <ErrorScreen title={s.invalidTitle} desc={s.invalidDesc} />

  if (link.revoked_at)
    return <ErrorScreen title={s.revokedTitle} desc={s.revokedDesc} />

  const expired = new Date(link.expires_at).getTime() < Date.now()
  if (expired) return <ErrorScreen title={s.expiredTitle} desc={s.expiredDesc} />

  const doc = link.compliance_docs as
    | {
        id: string
        kind: string
        title: string | null
        url: string
        mime_type: string | null
        size_bytes: number | null
        expires_at: string | null
        notes: string | null
      }
    | null

  if (!doc) return <ErrorScreen title={s.invalidTitle} desc={s.invalidDesc} />

  if (!PUBLICLY_SHAREABLE.has(doc.kind)) {
    return <ErrorScreen title={s.restrictedTitle} desc={s.restrictedDesc} />
  }

  // Best-effort telemetry — never blocks rendering. Swallow errors since the
  // page itself is more important than audit trail granularity.
  await admin
    .from("tokenized_share_links")
    .update({
      view_count: (link.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq("token", token)

  const ownerLabel =
    (link.profiles as { company_name?: string | null; full_name?: string | null } | null)
      ?.company_name ??
    (link.profiles as { full_name?: string | null } | null)?.full_name ??
    "Vexim Bridge"

  const expiresLabel = new Date(link.expires_at).toLocaleDateString(
    locale === "vi" ? "vi-VN" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  )

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{ownerLabel}</span>
              <span className="text-xs text-muted-foreground">{s.sharedBy}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {s.expiresOn.replace("{date}", expiresLabel)}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-foreground text-balance">
              {doc.title ?? s.defaultTitleByKind[doc.kind as keyof typeof s.defaultTitleByKind]}
            </h1>
            {doc.notes && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {doc.notes}
              </p>
            )}
          </div>

          {/* Stream the file through the authenticated proxy — the
              share token authorizes the viewer server-side. The raw
              `doc.url` (pathname) is never exposed to the browser. */}
          <DocViewer
            url={privateFileHref(doc.url, { token }) ?? "#"}
            mime={doc.mime_type}
            title={doc.title ?? doc.kind}
          />

          <div className="flex items-center justify-end">
            <Button asChild variant="outline">
              <a
                href={privateFileHref(doc.url, { token }) ?? "#"}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" />
                {s.download}
              </a>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 text-xs text-muted-foreground">
          {s.footer}
        </div>
      </footer>
    </div>
  )
}

function DocViewer({
  url,
  mime,
  title,
}: {
  url: string
  mime: string | null
  title: string
}) {
  if (mime?.startsWith("video/")) {
    return (
      <video
        src={url}
        controls
        playsInline
        className="w-full rounded-lg border border-border bg-black aspect-video"
      />
    )
  }
  if (mime?.startsWith("image/")) {
    return (
      <img
        src={url || "/placeholder.svg"}
        alt={title}
        className="w-full rounded-lg border border-border"
      />
    )
  }
  if (mime === "application/pdf") {
    return (
      <iframe
        src={url}
        title={title}
        className="w-full h-[70vh] rounded-lg border border-border bg-background"
      />
    )
  }
  // Fallback — just present a download link.
  return (
    <div className="rounded-lg border border-border bg-background p-8 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
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
