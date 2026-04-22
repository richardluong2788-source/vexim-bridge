"use client"

/**
 * ClientComplianceWorkspace — admin UI surface for SOP §0.2 & §0.3.
 *
 * Lets an admin:
 *   1. Upload the FDA registration scan, COA, price floor sheet, factory
 *      video/photos — each typed by `ComplianceDocKind`.
 *   2. Browse/delete existing documents, see file size / expiry / uploader.
 *   3. Mint tokenized share links (default 30 days) for shareable kinds:
 *        - single-doc: one token per document (the classic flow)
 *        - BUNDLE:    tick several docs, mint ONE token that renders
 *                     all of them on a single /share/[token] page
 *                     (migration 022 + `createBundleShareLinkAction`).
 *
 * Purely client-side — all writes go through server actions in
 * `app/admin/clients/compliance-actions.ts`.
 */

import { useMemo, useRef, useState, useTransition } from "react"
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
  Mail,
  Send,
  Layers,
  X as XIcon,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import type {
  ComplianceDoc,
  ComplianceDocKind,
  TokenizedShareLinkWithDocs,
} from "@/lib/supabase/types"
import { privateFileHref } from "@/lib/blob/file-url"
import {
  uploadClientDocAction,
  deleteClientDocAction,
  createShareLinkAction,
  createBundleShareLinkAction,
  revokeShareLinkAction,
  resendShareLinkEmailAction,
} from "@/app/admin/clients/compliance-actions"
import { useTranslation } from "@/components/i18n/language-provider"
import { cn } from "@/lib/utils"

interface Props {
  clientId: string
  clientName: string
  initialDocs: ComplianceDoc[]
  initialLinks: TokenizedShareLinkWithDocs[]
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
  const [links, setLinks] = useState<TokenizedShareLinkWithDocs[]>(initialLinks)

  // Selection state for batch bundle-link creation. Keyed by doc id.
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function handleUploaded(doc: ComplianceDoc) {
    setDocs((prev) => [doc, ...prev])
  }
  function handleDeleted(docId: string) {
    setDocs((prev) => prev.filter((d) => d.id !== docId))
    // Drop from selection.
    setSelected((prev) => {
      if (!prev.has(docId)) return prev
      const next = new Set(prev)
      next.delete(docId)
      return next
    })
    // Remove single-doc links; strip from bundle doc_ids lists.
    setLinks((prev) =>
      prev
        .filter((l) => l.doc_id !== docId)
        .map((l) =>
          l.doc_ids.includes(docId)
            ? { ...l, doc_ids: l.doc_ids.filter((id) => id !== docId) }
            : l,
        ),
    )
  }
  function handleLinkCreated(link: TokenizedShareLinkWithDocs) {
    setLinks((prev) => [link, ...prev])
  }
  function handleLinkRevoked(token: string) {
    setLinks((prev) =>
      prev.map((l) =>
        l.token === token ? { ...l, revoked_at: new Date().toISOString() } : l,
      ),
    )
  }

  function toggleSelected(docId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }
  function clearSelection() {
    setSelected(new Set())
  }

  // Partition links into per-doc vs bundle (doc_id null) for distinct sections.
  const { bundleLinks } = useMemo(() => {
    return {
      bundleLinks: links.filter((l) => !l.doc_id),
    }
  }, [links])

  // Docs map for quick bundle membership labels.
  const docsById = useMemo(() => {
    const m = new Map<string, ComplianceDoc>()
    for (const d of docs) m.set(d.id, d)
    return m
  }, [docs])

  return (
    <div className="flex flex-col gap-8">
      {/* Upload panel */}
      <UploadPanel clientId={clientId} onUploaded={handleUploaded} />

      {/* Active bundle links (if any) */}
      {bundleLinks.length > 0 && (
        <BundleLinksSection
          links={bundleLinks}
          docsById={docsById}
          onRevoked={handleLinkRevoked}
        />
      )}

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {DOC_KINDS.map((kind) => {
              const bucket = docs.filter((d) => d.kind === kind)
              if (bucket.length === 0) return null
              const Icon = KIND_ICON[kind]
              return (
                <section
                  key={kind}
                  className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {s.kinds[kind]}
                    </h3>
                    <Badge variant="secondary" className="font-normal ml-auto">
                      {bucket.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {bucket.map((doc) => {
                      const selectable = SHAREABLE_KINDS.includes(doc.kind)
                      return (
                        <DocCard
                          key={doc.id}
                          doc={doc}
                          links={links.filter((l) => l.doc_id === doc.id)}
                          onDeleted={handleDeleted}
                          onLinkCreated={handleLinkCreated}
                          onLinkRevoked={handleLinkRevoked}
                          canShare={selectable}
                          selectable={selectable}
                          isSelected={selected.has(doc.id)}
                          onToggleSelect={() => toggleSelected(doc.id)}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky selection bar — only shows while docs are ticked. */}
      {selected.size > 0 && (
        <SelectionBar
          clientId={clientId}
          selectedIds={Array.from(selected)}
          onClear={clearSelection}
          onCreated={(link) => {
            handleLinkCreated(link)
            clearSelection()
          }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Selection bar + bundle dialog
// ────────────────────────────────────────────────────────────────────────────

function SelectionBar({
  clientId: _clientId,
  selectedIds,
  onClear,
  onCreated,
}: {
  clientId: string
  selectedIds: string[]
  onClear: () => void
  onCreated: (link: TokenizedShareLinkWithDocs) => void
}) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance

  return (
    <div
      // Floating footer — hugs the bottom of the viewport so the admin
      // can keep scrolling the doc grid while reviewing the selection.
      className="sticky bottom-4 z-30 mx-auto w-full max-w-3xl rounded-full border border-border bg-background/95 backdrop-blur shadow-lg"
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {s.selectedCount.replace("{count}", String(selectedIds.length))}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onClear}>
            <XIcon className="h-3.5 w-3.5" />
            {s.clearSelection}
          </Button>
          <CreateBundleLinkDialog
            docIds={selectedIds}
            onCreated={onCreated}
          />
        </div>
      </div>
    </div>
  )
}

function CreateBundleLinkDialog({
  docIds,
  onCreated,
}: {
  docIds: string[]
  onCreated: (link: TokenizedShareLinkWithDocs) => void
}) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance
  const [open, setOpen] = useState(false)
  const [ttl, setTtl] = useState("30")
  const [note, setNote] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerCompany, setBuyerCompany] = useState("")
  const [senderMessage, setSenderMessage] = useState("")
  const [pending, startTransition] = useTransition()
  const hasEmail = buyerEmail.trim().length > 0

  function resetForm() {
    setTtl("30")
    setNote("")
    setBuyerEmail("")
    setBuyerName("")
    setBuyerCompany("")
    setSenderMessage("")
  }

  function handleCreate() {
    if (docIds.length === 0) {
      toast.error(s.selectAtLeastOne)
      return
    }
    startTransition(async () => {
      const res = await createBundleShareLinkAction({
        docIds,
        ttlDays: Number(ttl) || 30,
        note: note.trim() || null,
        buyerEmail: buyerEmail.trim() || null,
        buyerName: buyerName.trim() || null,
        buyerCompany: buyerCompany.trim() || null,
        senderMessage: senderMessage.trim() || null,
      })
      if (!res.ok) {
        toast.error(s.errorGeneric)
        return
      }

      if (hasEmail) {
        if (res.data!.emailSent) toast.success(s.bundleLinkEmailSent)
        else if (res.data!.emailError === "invalidEmail")
          toast.warning(s.invalidEmail)
        else toast.warning(s.bundleLinkEmailFailed)
      } else {
        toast.success(s.bundleLinkCreated)
      }

      // Optimistic link row so the UI updates before the next revalidate.
      const optimistic: TokenizedShareLinkWithDocs = {
        token: res.data!.token,
        doc_id: null,
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
        doc_ids: docIds,
      }
      onCreated(optimistic)
      setOpen(false)
      resetForm()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Layers className="h-3.5 w-3.5" />
          {s.createBundleLink}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{s.createBundleTitle}</DialogTitle>
          <DialogDescription>{s.createBundleDesc}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {s.bundleDocsListTitle}
            </p>
            <p className="text-sm text-foreground">
              {s.bundleDocCount.replace("{count}", String(docIds.length))}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bundle-ttl">{s.ttlDays}</Label>
              <Input
                id="bundle-ttl"
                type="number"
                min={1}
                max={365}
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{s.ttlHint}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bundle-note">{s.note}</Label>
              <Input
                id="bundle-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={s.notePlaceholder}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {s.emailSectionTitle}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.emailSectionHint}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bundle-buyerEmail">{s.buyerEmail}</Label>
                <Input
                  id="bundle-buyerEmail"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder={s.buyerEmailPlaceholder}
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bundle-buyerName">{s.buyerName}</Label>
                  <Input
                    id="bundle-buyerName"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder={s.buyerNamePlaceholder}
                    disabled={!hasEmail}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bundle-buyerCompany">{s.buyerCompany}</Label>
                  <Input
                    id="bundle-buyerCompany"
                    value={buyerCompany}
                    onChange={(e) => setBuyerCompany(e.target.value)}
                    placeholder={s.buyerCompanyPlaceholder}
                    disabled={!hasEmail}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bundle-senderMessage">{s.senderMessage}</Label>
                <Textarea
                  id="bundle-senderMessage"
                  value={senderMessage}
                  onChange={(e) => setSenderMessage(e.target.value)}
                  placeholder={s.senderMessagePlaceholder}
                  rows={3}
                  disabled={!hasEmail}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {s.cancel}
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? (
              <Spinner className="h-4 w-4" />
            ) : hasEmail ? (
              <Send className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {hasEmail ? s.createAndSend : s.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bundle links display section
// ────────────────────────────────────────────────────────────────────────────

function BundleLinksSection({
  links,
  docsById,
  onRevoked,
}: {
  links: TokenizedShareLinkWithDocs[]
  docsById: Map<string, ComplianceDoc>
  onRevoked: (token: string) => void
}) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {s.bundleLinksTitle}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        {s.bundleLinksSubtitle}
      </p>
      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <ShareLinkRow
            key={link.token}
            link={link}
            docCount={link.doc_ids.length}
            docLabels={link.doc_ids
              .map((id) => {
                const d = docsById.get(id)
                if (!d) return null
                return d.title ?? s.kinds[d.kind]
              })
              .filter((label): label is string => !!label)}
            onRevoked={() => onRevoked(link.token)}
          />
        ))}
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
  selectable,
  isSelected,
  onToggleSelect,
}: {
  doc: ComplianceDoc
  links: TokenizedShareLinkWithDocs[]
  onDeleted: (docId: string) => void
  onLinkCreated: (link: TokenizedShareLinkWithDocs) => void
  onLinkRevoked: (token: string) => void
  canShare: boolean
  selectable: boolean
  isSelected: boolean
  onToggleSelect: () => void
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
    <Card
      className={cn(
        "border-border transition-colors",
        isSelected && "border-primary ring-1 ring-primary/20 bg-primary/5",
      )}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start gap-2">
          {selectable && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              aria-label={s.selectForBundle}
              className="mt-1"
            />
          )}
          <div className="flex flex-col min-w-0 flex-1">
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
              <a
                href={privateFileHref(doc.url) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.view}
              >
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

// ────────────────────────────────────────────────────────────────────────────
// Tokenized share link row + dialogs
// ────────────────────────────────────────────────────────────────────────────

function ShareLinkRow({
  link,
  onRevoked,
  docCount,
  docLabels,
}: {
  link: TokenizedShareLinkWithDocs
  onRevoked: () => void
  docCount?: number
  docLabels?: string[]
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

  const isBundle = !!docCount && docCount > 1

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 border border-border p-2 text-xs">
      {isBundle ? (
        <Layers
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isExpired ? "text-destructive" : "text-primary",
          )}
        />
      ) : (
        <Link2
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isExpired ? "text-destructive" : "text-primary",
          )}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-mono truncate text-foreground">{publicUrl}</p>
          {isBundle && (
            <Badge variant="secondary" className="font-normal">
              {s.bundleDocCount.replace("{count}", String(docCount))}
            </Badge>
          )}
        </div>
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
        {docLabels && docLabels.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {docLabels.join(" · ")}
          </p>
        )}
      </div>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleCopy}>
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
      {/*
       * Resend-email flow currently only supports single-doc links
       * (see `resendShareLinkEmailAction`). For bundle tokens, admins
       * can copy the URL and send manually for now.
       */}
      {!isBundle && !isExpired && !link.revoked_at && (
        <ResendEmailDialog token={link.token} />
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-destructive hover:text-destructive"
        onClick={handleRevoke}
        disabled={pending}
        title={s.confirmRevoke}
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
  onCreated: (link: TokenizedShareLinkWithDocs) => void
  triggerLabel: string
}) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance
  const [open, setOpen] = useState(false)
  const [ttl, setTtl] = useState("30")
  const [note, setNote] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerCompany, setBuyerCompany] = useState("")
  const [senderMessage, setSenderMessage] = useState("")
  const [pending, startTransition] = useTransition()

  const hasEmail = buyerEmail.trim().length > 0

  function resetForm() {
    setTtl("30")
    setNote("")
    setBuyerEmail("")
    setBuyerName("")
    setBuyerCompany("")
    setSenderMessage("")
  }

  function handleCreate() {
    startTransition(async () => {
      const res = await createShareLinkAction({
        docId,
        ttlDays: Number(ttl) || 30,
        note: note.trim() || null,
        buyerEmail: buyerEmail.trim() || null,
        buyerName: buyerName.trim() || null,
        buyerCompany: buyerCompany.trim() || null,
        senderMessage: senderMessage.trim() || null,
      })
      if (!res.ok) {
        toast.error(s.errorGeneric)
        return
      }

      if (hasEmail) {
        if (res.data!.emailSent) toast.success(s.linkCreatedEmailSent)
        else if (res.data!.emailError === "invalidEmail")
          toast.warning(s.invalidEmail)
        else toast.warning(s.linkCreatedEmailFailed)
      } else {
        toast.success(s.linkCreated)
      }

      const optimistic: TokenizedShareLinkWithDocs = {
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
        doc_ids: [docId],
      }
      onCreated(optimistic)
      setOpen(false)
      resetForm()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Link2 className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{s.createLinkTitle}</DialogTitle>
          <DialogDescription>{s.createLinkDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
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

          <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {s.emailSectionTitle}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.emailSectionHint}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="buyerEmail">{s.buyerEmail}</Label>
                <Input
                  id="buyerEmail"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder={s.buyerEmailPlaceholder}
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="buyerName">{s.buyerName}</Label>
                  <Input
                    id="buyerName"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder={s.buyerNamePlaceholder}
                    disabled={!hasEmail}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="buyerCompany">{s.buyerCompany}</Label>
                  <Input
                    id="buyerCompany"
                    value={buyerCompany}
                    onChange={(e) => setBuyerCompany(e.target.value)}
                    placeholder={s.buyerCompanyPlaceholder}
                    disabled={!hasEmail}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senderMessage">{s.senderMessage}</Label>
                <Textarea
                  id="senderMessage"
                  value={senderMessage}
                  onChange={(e) => setSenderMessage(e.target.value)}
                  placeholder={s.senderMessagePlaceholder}
                  rows={3}
                  disabled={!hasEmail}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {s.cancel}
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? (
              <Spinner className="h-4 w-4" />
            ) : hasEmail ? (
              <Send className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {hasEmail ? s.createAndSend : s.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResendEmailDialog({ token }: { token: string }) {
  const { t } = useTranslation()
  const s = t.admin.clients.compliance
  const [open, setOpen] = useState(false)
  const [buyerEmail, setBuyerEmail] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerCompany, setBuyerCompany] = useState("")
  const [senderMessage, setSenderMessage] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSend() {
    const email = buyerEmail.trim()
    if (!email) {
      toast.error(s.invalidEmail)
      return
    }
    startTransition(async () => {
      const res = await resendShareLinkEmailAction({
        token,
        buyerEmail: email,
        buyerName: buyerName.trim() || null,
        buyerCompany: buyerCompany.trim() || null,
        senderMessage: senderMessage.trim() || null,
      })
      if (!res.ok) {
        const map: Record<string, string> = {
          invalidEmail: s.invalidEmail,
          emailFailed: s.emailFailed,
          linkRevoked: s.linkRevoked,
          linkExpired: s.linkExpired,
          notFound: s.errorGeneric,
        }
        toast.error(map[res.error] ?? s.errorGeneric)
        return
      }
      toast.success(s.resendSent)
      setOpen(false)
      setBuyerEmail("")
      setBuyerName("")
      setBuyerCompany("")
      setSenderMessage("")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          title={s.resendEmail}
        >
          <Mail className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{s.resendEmail}</DialogTitle>
          <DialogDescription>{s.resendEmailDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resendBuyerEmail">{s.buyerEmail}</Label>
            <Input
              id="resendBuyerEmail"
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder={s.buyerEmailPlaceholder}
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resendBuyerName">{s.buyerName}</Label>
              <Input
                id="resendBuyerName"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder={s.buyerNamePlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resendBuyerCompany">{s.buyerCompany}</Label>
              <Input
                id="resendBuyerCompany"
                value={buyerCompany}
                onChange={(e) => setBuyerCompany(e.target.value)}
                placeholder={s.buyerCompanyPlaceholder}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resendMessage">{s.senderMessage}</Label>
            <Textarea
              id="resendMessage"
              value={senderMessage}
              onChange={(e) => setSenderMessage(e.target.value)}
              placeholder={s.senderMessagePlaceholder}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {s.cancel}
          </Button>
          <Button onClick={handleSend} disabled={pending}>
            {pending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {s.resendEmail}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
