"use client"

/**
 * ClientComplianceWorkspace — admin UI surface for SOP §0.2 & §0.3.
 *
 * Lets an admin:
 *   1. Upload the FDA registration scan, COA, price floor sheet, factory
 *      video/photos — each typed by `ComplianceDocKind`.
 *   2. Browse/delete existing documents, see file size / expiry / uploader.
 *   3. Mint a tokenized share link (default 30 days) for a factory video or
 *      price floor sheet so a buyer can view it via `/share/[token]` without
 *      a VXB account.
 *
 * Purely client-side — all writes go through server actions in
 * `app/admin/clients/compliance-actions.ts`.
 */

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  FileBadge2,
  FlaskConical,
  DollarSign,
  Video,
  Image as ImageIcon,
  File as FileIcon,
  Upload,
  Trash2,
  Link2,
  Copy,
  Check,
  ShieldBan,
  ExternalLink,
  Clock,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ComplianceDoc, ComplianceDocKind, TokenizedShareLink } from "@/lib/supabase/types"
import {
  uploadClientDocAction,
  deleteClientDocAction,
  createShareLinkAction,
  revokeShareLinkAction,
} from "@/app/admin/clients/compliance-actions"
import { useTranslation } from "@/components/i18n/language-provider"
import { cn } from "@/lib/utils"

interface Props {
  clientId: string
  clientName: string
  initialDocs: ComplianceDoc[]
  initialLinks: TokenizedShareLink[]
}

// Ordered so the most critical docs (FDA, COA) sit at the top of the list.
const DOC_KINDS: ComplianceDocKind[] = [
  "fda_certificate",
  "coa",
  "price_floor",
  "factory_video",
  "factory_photo",
  "other",
]

const KIND_ICON: Record<ComplianceDocKind, React.ComponentType<{ className?: string }>> = {
  fda_certificate: FileBadge2,
  coa: FlaskConical,
  price_floor: DollarSign,
  factory_video: Video,
  factory_photo: ImageIcon,
  other: FileIcon,
}

// Which kinds are eligible for public sharing via tokenized link.
const SHAREABLE_KINDS: ComplianceDocKind[] = ["factory_video", "price_floor", "factory_photo"]

export function ClientComplianceWorkspace({
  clientId,
  clientName,
  initialDocs,
  initialLinks,
}: Props) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance

  const [docs, setDocs] = useState<ComplianceDoc[]>(initialDocs)
  const [links, setLinks] = useState<TokenizedShareLink[]>(initialLinks)

  function handleUploaded(doc: ComplianceDoc) {
    setDocs((prev) => [doc, ...prev])
  }
  function handleDeleted(docId: string) {
    setDocs((prev) => prev.filter((d) => d.id !== docId))
    setLinks((prev) => prev.filter((l) => l.doc_id !== docId))
  }
  function handleLinkCreated(link: TokenizedShareLink) {
    setLinks((prev) => [link, ...prev])
  }
  function handleLinkRevoked(token: string) {
    setLinks((prev) =>
      prev.map((l) =>
        l.token === token ? { ...l, revoked_at: new Date().toISOString() } : l,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Upload panel */}
      <UploadPanel clientId={clientId} onUploaded={handleUploaded} />

      {/* Docs grouped by kind */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{s.docsTitle}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {s.docsSubtitle.replace("{company}", clientName)}
            </p>
          </div>
        </div>

        {docs.length === 0 ? (
          <Card className="border-border">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{s.empty}</EmptyTitle>
                <EmptyDescription>{s.emptyDesc}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {DOC_KINDS.map((kind) => {
              const bucket = docs.filter((d) => d.kind === kind)
              if (bucket.length === 0) return null
              const Icon = KIND_ICON[kind]
              return (
                <section key={kind}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                      {s.kinds[kind]}
                    </h3>
                    <Badge variant="secondary" className="font-normal">
                      {bucket.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {bucket.map((doc) => (
                      <DocCard
                        key={doc.id}
                        doc={doc}
                        links={links.filter((l) => l.doc_id === doc.id)}
                        onDeleted={handleDeleted}
                        onLinkCreated={handleLinkCreated}
                        onLinkRevoked={handleLinkRevoked}
                        canShare={SHAREABLE_KINDS.includes(doc.kind)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Upload panel
// ────────────────────────────────────────────────────────────────────────────

function UploadPanel({
  clientId,
  onUploaded,
}: {
  clientId: string
  onUploaded: (doc: ComplianceDoc) => void
}) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance
  const [kind, setKind] = useState<ComplianceDocKind>("fda_certificate")
  const [title, setTitle] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [hasFile, setHasFile] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.error(s.missingFile)
      return
    }
    const fd = new FormData()
    fd.set("ownerId", clientId)
    fd.set("kind", kind)
    fd.set("title", title)
    fd.set("expiresAt", expiresAt)
    fd.set("notes", notes)
    fd.set("file", file)

    startTransition(async () => {
      const res = await uploadClientDocAction(fd)
      if (!res.ok) {
        toast.error(translateError(s, res.error))
        return
      }
      toast.success(s.uploadSuccess)

      // Build an optimistic doc record so the UI reflects the new file instantly.
      const optimistic: ComplianceDoc = {
        id: res.data!.id,
        owner_id: clientId,
        kind,
        title: title.trim() || null,
        url: res.data!.url,
        mime_type: file.type || null,
        size_bytes: file.size,
        issued_at: null,
        expires_at: expiresAt || null,
        notes: notes.trim() || null,
        uploaded_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      onUploaded(optimistic)

      // Reset form
      setTitle("")
      setExpiresAt("")
      setNotes("")
      setHasFile(false)
      if (fileRef.current) fileRef.current.value = ""
    })
  }

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{s.uploadTitle}</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="docKind">{s.docKind}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ComplianceDocKind)}>
                <SelectTrigger id="docKind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {s.kinds[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="docExpires">{s.expiresAt}</Label>
              <Input
                id="docExpires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="docTitle">{s.docTitle}</Label>
            <Input
              id="docTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={s.docTitlePlaceholder}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="docFile">{s.file}</Label>
            <Input
              id="docFile"
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
              onChange={(e) => setHasFile(!!e.target.files?.length)}
              required
            />
            <p className="text-xs text-muted-foreground">{s.fileHint}</p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !hasFile}>
              {pending ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {s.uploading}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {s.upload2}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Document card
// ────────────────────────────────────────────────────────────────────────────

function DocCard({
  doc,
  links,
  onDeleted,
  onLinkCreated,
  onLinkRevoked,
  canShare,
}: {
  doc: ComplianceDoc
  links: TokenizedShareLink[]
  onDeleted: (docId: string) => void
  onLinkCreated: (link: TokenizedShareLink) => void
  onLinkRevoked: (token: string) => void
  canShare: boolean
}) {
  const { t, locale } = useTranslation()
  const s = t.admin.clients.compliance
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const [deleting, startDelete] = useTransition()

  function handleDelete() {
    if (!confirm(s.confirmDelete)) return
    startDelete(async () => {
      const res = await deleteClientDocAction(doc.id)
      if (!res.ok) {
        toast.error(s.errorGeneric)
        return
      }
      toast.success(s.deleted)
      onDeleted(doc.id)
    })
  }

  const expiresLabel = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString(dateLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null
  const isExpired = doc.expires_at
    ? new Date(doc.expires_at).getTime() < Date.now()
    : false

  const activeLinks = links.filter((l) => !l.revoked_at)

  return (
    <Card className="border-border">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {doc.title ?? s.kinds[doc.kind]}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBytes(doc.size_bytes)} ·{" "}
              {new Date(doc.created_at).toLocaleDateString(dateLocale, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {expiresLabel && (
              <p
                className={cn(
                  "text-xs mt-0.5 flex items-center gap-1",
                  isExpired ? "text-destructive font-medium" : "text-muted-foreground",
                )}
              >
                <Clock className="h-3 w-3" />
                {isExpired ? s.expiredOn : s.expiresOn}: {expiresLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button asChild size="icon" variant="ghost" className="h-8 w-8">
              <a href={doc.url} target="_blank" rel="noopener noreferrer" aria-label={s.view}>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={s.delete}
            >
              {deleting ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {canShare && (
          <div className="border-t border-border pt-3 flex flex-col gap-2">
            {activeLinks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {activeLinks.map((link) => (
                  <ShareLinkRow
                    key={link.token}
                    link={link}
                    onRevoked={() => onLinkRevoked(link.token)}
                  />
                ))}
                <CreateLinkDialog
                  docId={doc.id}
                  onCreated={onLinkCreated}
                  triggerLabel={s.addAnotherLink}
                />
              </div>
            ) : (
              <CreateLinkDialog
                docId={doc.id}
                onCreated={onLinkCreated}
                triggerLabel={s.createLink}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────���──────────────────────────────
// Tokenized share link row + dialog
// ────────────────────────────────────────────────────────────────────────────

function ShareLinkRow({
  link,
  onRevoked,
}: {
  link: TokenizedShareLink
  onRevoked: () => void
}) {
  const { t, locale } = useTranslation()
  const s = t.admin.clients.compliance
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${link.token}`
      : `/share/${link.token}`

  const expiresLabel = new Date(link.expires_at).toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const isExpired = new Date(link.expires_at).getTime() < Date.now()

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(s.errorGeneric)
    }
  }

  function handleRevoke() {
    if (!confirm(s.confirmRevoke)) return
    startTransition(async () => {
      const res = await revokeShareLinkAction(link.token)
      if (!res.ok) {
        toast.error(s.errorGeneric)
        return
      }
      toast.success(s.revoked)
      onRevoked()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 border border-border p-2 text-xs">
      <Link2
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isExpired ? "text-destructive" : "text-primary",
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="font-mono truncate text-foreground">{publicUrl}</p>
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <Clock className="h-3 w-3" />
          {isExpired ? s.expiredOn : s.expiresOn}: {expiresLabel}
          {link.view_count > 0 && (
            <span className="flex items-center gap-1 ml-1">
              <Eye className="h-3 w-3" />
              {link.view_count}
            </span>
          )}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-destructive hover:text-destructive"
        onClick={handleRevoke}
        disabled={pending}
      >
        <ShieldBan className="h-3 w-3" />
      </Button>
    </div>
  )
}

function CreateLinkDialog({
  docId,
  onCreated,
  triggerLabel,
}: {
  docId: string
  onCreated: (link: TokenizedShareLink) => void
  triggerLabel: string
}) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance
  const [open, setOpen] = useState(false)
  const [ttl, setTtl] = useState("30")
  const [note, setNote] = useState("")
  const [pending, startTransition] = useTransition()

  function handleCreate() {
    startTransition(async () => {
      const res = await createShareLinkAction({
        docId,
        ttlDays: Number(ttl) || 30,
        note: note.trim() || null,
      })
      if (!res.ok) {
        toast.error(s.errorGeneric)
        return
      }
      toast.success(s.linkCreated)
      // Optimistic link
      const optimistic: TokenizedShareLink = {
        token: res.data!.token,
        doc_id: docId,
        owner_id: "",
        created_by: null,
        expires_at: new Date(
          Date.now() + (Number(ttl) || 30) * 24 * 60 * 60 * 1000,
        ).toISOString(),
        revoked_at: null,
        view_count: 0,
        last_viewed_at: null,
        note: note.trim() || null,
        created_at: new Date().toISOString(),
      }
      onCreated(optimistic)
      setOpen(false)
      setNote("")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Link2 className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{s.createLinkTitle}</DialogTitle>
          <DialogDescription>{s.createLinkDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ttl">{s.ttlDays}</Label>
            <Input
              id="ttl"
              type="number"
              min={1}
              max={365}
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{s.ttlHint}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkNote">{s.note}</Label>
            <Input
              id="linkNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={s.notePlaceholder}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {s.cancel}
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? <Spinner className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {s.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Map a server-action error code to a user-facing translation from the
 * `compliance` dictionary. Falls back to a generic message for unknown keys.
 */
function translateError(
  s: {
    errorGeneric: string
    errorFileTooLarge: string
    errorInvalidType: string
    errorMissingToken: string
  },
  code: string,
): string {
  switch (code) {
    case "fileTooLarge":
      return s.errorFileTooLarge
    case "invalidType":
      return s.errorInvalidType
    case "missingToken":
      return s.errorMissingToken
    default:
      return s.errorGeneric
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
