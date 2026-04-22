/**
 * Public tokenized share page.
 *
 * A buyer receives a link like `https://esh.example/share/<uuid-token>` and
 * can view the associated compliance doc(s) without authenticating — but only
 * as long as:
 *   1. The token has NOT been revoked.
 *   2. `expires_at` is in the future.
 *
 * Two shapes of token coexist:
 *   - Single-doc: `tokenized_share_links.doc_id` is set. One doc is rendered.
 *   - Bundle    : `doc_id` is null. Docs come from `tokenized_share_link_docs`
 *                 and are rendered as a vertical stack on one page.
 *
 * We increment `view_count` once per page load and refresh `last_viewed_at`
 * so admins can audit engagement from the client workspace.
 *
 * This route is explicitly NOT protected by the admin middleware layer.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { getDictionary } from "@/lib/i18n/server"
import {
  ShieldAlert,
  Clock,
  Building2,
  Download,
  FileBadge2,
  FlaskConical,
  DollarSign,
  Video,
  Image as ImageIcon,
  File as FileIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { privateFileHref } from "@/lib/blob/file-url"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ token: string }>
}

// Docs surfaceable over a public link. The Vexim team redacts
// sensitive fields (legal name, FDA reg, factory address) before
// upload, so every supported kind is allowed on the public viewer.
const PUBLICLY_SHAREABLE = new Set<string>([
  "fda_certificate",
  "coa",
  "price_floor",
  "factory_video",
  "factory_photo",
  "other",
])

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  fda_certificate: FileBadge2,
  coa: FlaskConical,
  price_floor: DollarSign,
  factory_video: Video,
  factory_photo: ImageIcon,
  other: FileIcon,
}

type PublicDoc = {
  id: string
  kind: string
  title: string | null
  url: string
  mime_type: string | null
  size_bytes: number | null
  expires_at: string | null
  notes: string | null
}

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
      "token, doc_id, owner_id, expires_at, revoked_at, view_count, note, profiles:owner_id ( company_name, full_name )",
    )
    .eq("token", token)
    .maybeSingle()

  if (!link) return <ErrorScreen title={s.invalidTitle} desc={s.invalidDesc} />
  if (link.revoked_at)
    return <ErrorScreen title={s.revokedTitle} desc={s.revokedDesc} />

  const expired = new Date(link.expires_at).getTime() < Date.now()
  if (expired) return <ErrorScreen title={s.expiredTitle} desc={s.expiredDesc} />

  // Resolve docs: either the single-doc row or the bundle's join rows.
  let docs: PublicDoc[] = []

  if (link.doc_id) {
    const { data: doc } = await admin
      .from("compliance_docs")
      .select(
        "id, kind, title, url, mime_type, size_bytes, expires_at, notes",
      )
      .eq("id", link.doc_id)
      .maybeSingle()
    if (doc) docs = [doc as PublicDoc]
  } else {
    const { data: rows } = await admin
      .from("tokenized_share_link_docs")
      .select(
        "position, compliance_docs:doc_id ( id, kind, title, url, mime_type, size_bytes, expires_at, notes )",
      )
      .eq("token", token)
      .order("position", { ascending: true })

    if (rows) {
      docs = rows
        .map((r) => {
          const rel = (r as { compliance_docs?: unknown }).compliance_docs
          return (Array.isArray(rel) ? rel[0] : rel) as PublicDoc | null
        })
        .filter((d): d is PublicDoc => !!d)
    }
  }

  // Defence-in-depth: drop any kinds that aren't on the public whitelist.
  docs = docs.filter((d) => PUBLICLY_SHAREABLE.has(d.kind))

  if (docs.length === 0) {
    return <ErrorScreen title={s.restrictedTitle} desc={s.restrictedDesc} />
  }

  // Best-effort telemetry — never blocks rendering.
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

  const isBundle = docs.length > 1
  const pageTitle = isBundle
    ? s.bundleTitle.replace("{company}", ownerLabel)
    : (docs[0].title ??
      s.defaultTitleByKind[docs[0].kind as keyof typeof s.defaultTitleByKind])
  const pageSubtitle = isBundle
    ? s.bundleSubtitle.replace("{count}", String(docs.length))
    : null

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
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-foreground text-balance">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
            )}
          </div>

          {/* Sticky jump-to nav when bundle has 2+ docs. Lets the
              buyer skip around long videos without scroll-fatigue. */}
          {isBundle && (
            <nav
              aria-label={s.bundleTocLabel}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {s.bundleTocLabel}
              </p>
              <ul className="flex flex-col gap-1">
                {docs.map((doc, idx) => {
                  const Icon = KIND_ICON[doc.kind] ?? FileIcon
                  return (
                    <li key={doc.id}>
                      <a
                        href={`#doc-${doc.id}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                      >
                        <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                          {idx + 1}.
                        </span>
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {doc.title ??
                            s.defaultTitleByKind[
                              doc.kind as keyof typeof s.defaultTitleByKind
                            ]}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}

          {/* Doc sections */}
          {docs.map((doc, idx) => (
            <DocSection
              key={doc.id}
              doc={doc}
              token={token}
              kindLabel={
                s.defaultTitleByKind[
                  doc.kind as keyof typeof s.defaultTitleByKind
                ] ?? doc.kind
              }
              showHeader={isBundle}
              index={idx + 1}
              downloadLabel={s.download}
            />
          ))}
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

function DocSection({
  doc,
  token,
  kindLabel,
  showHeader,
  index,
  downloadLabel,
}: {
  doc: PublicDoc
  token: string
  kindLabel: string
  showHeader: boolean
  index: number
  downloadLabel: string
}) {
  const href = privateFileHref(doc.url, { token }) ?? "#"
  const Icon = KIND_ICON[doc.kind] ?? FileIcon

  return (
    <section
      id={`doc-${doc.id}`}
      className="flex flex-col gap-4 scroll-mt-24"
    >
      {showHeader && (
        <div className="flex items-start gap-3 border-b border-border pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">
                {String(index).padStart(2, "0")}
              </span>
              <Badge variant="secondary" className="font-normal">
                {kindLabel}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-1 text-pretty">
              {doc.title ?? kindLabel}
            </h2>
            {doc.notes && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {doc.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {!showHeader && doc.notes && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {doc.notes}
        </p>
      )}

      <DocViewer url={href} mime={doc.mime_type} title={doc.title ?? doc.kind} />

      <div className="flex items-center justify-end">
        <Button asChild variant="outline" size="sm">
          <a href={href} download target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" />
            {downloadLabel}
          </a>
        </Button>
      </div>
    </section>
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
