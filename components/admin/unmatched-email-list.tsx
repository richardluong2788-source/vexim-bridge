"use client"

import { useMemo, useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MailQuestion, CheckCircle2, RotateCcw } from "lucide-react"
import { useTranslation } from "@/components/i18n/language-provider"
import { markUnmatchedEmailReviewed, reopenUnmatchedEmail } from "@/app/admin/unmatched-emails/actions"
import { cn } from "@/lib/utils"

export interface UnmatchedEmailListItem {
  id: string
  from_email: string
  to_emails: string[]
  subject: string | null
  raw_content: string | null
  match_attempt_note: string | null
  received_at: string
  reviewed: boolean
  reviewed_at: string | null
  review_note: string | null
  reviewer: { full_name: string | null; email: string | null } | null
}

function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function UnmatchedEmailList({ items }: { items: UnmatchedEmailListItem[] }) {
  const { t, locale } = useTranslation()
  const [tab, setTab] = useState<"unreviewed" | "reviewed">("unreviewed")

  const unreviewed = useMemo(() => items.filter((i) => !i.reviewed), [items])
  const reviewed = useMemo(() => items.filter((i) => i.reviewed), [items])

  const visible = tab === "unreviewed" ? unreviewed : reviewed

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "unreviewed" | "reviewed")}>
        <TabsList>
          <TabsTrigger value="unreviewed" className="gap-2">
            {t.admin.unmatchedEmails.tabUnreviewed}
            {unreviewed.length > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-[11px]">
                {unreviewed.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed">{t.admin.unmatchedEmails.tabReviewed}</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <MailQuestion className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {tab === "unreviewed" ? t.admin.unmatchedEmails.empty : t.admin.unmatchedEmails.emptyReviewed}
            </p>
            {tab === "unreviewed" && (
              <p className="max-w-sm text-sm text-muted-foreground">{t.admin.unmatchedEmails.emptyDesc}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            <UnmatchedEmailCard key={item.id} item={item} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}

function UnmatchedEmailCard({
  item,
  locale,
}: {
  item: UnmatchedEmailListItem
  locale: string
}) {
  const { t } = useTranslation()
  const [note, setNote] = useState(item.review_note ?? "")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleMarkReviewed() {
    setError(null)
    startTransition(async () => {
      const res = await markUnmatchedEmailReviewed(item.id, note)
      if (!res.ok) setError(t.admin.unmatchedEmails.errorGeneric)
    })
  }

  function handleReopen() {
    setError(null)
    startTransition(async () => {
      const res = await reopenUnmatchedEmail(item.id)
      if (!res.ok) setError(t.admin.unmatchedEmails.errorGeneric)
    })
  }

  return (
    <Card className={cn("border-border", item.reviewed && "bg-muted/30")}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {item.subject || "(no subject)"}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground/70">{t.admin.unmatchedEmails.from}:</span>{" "}
                {item.from_email}
              </span>
              <span>
                <span className="font-medium text-foreground/70">{t.admin.unmatchedEmails.to}:</span>{" "}
                {item.to_emails.join(", ") || "—"}
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(item.received_at, locale)}
          </span>
        </div>

        {item.match_attempt_note && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <span className="font-medium shrink-0">{t.admin.unmatchedEmails.reason}:</span>
            <span className="font-mono">{item.match_attempt_note}</span>
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t.admin.unmatchedEmails.body}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90 line-clamp-6">
            {item.raw_content?.trim() || t.admin.unmatchedEmails.noBody}
          </p>
        </div>

        {item.reviewed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                {t.admin.unmatchedEmails.reviewedBy}
                {item.reviewed_at ? ` · ${formatDate(item.reviewed_at, locale)}` : ""}
                {item.reviewer?.full_name || item.reviewer?.email
                  ? ` · ${item.reviewer.full_name ?? item.reviewer.email}`
                  : ""}
              </span>
              {item.review_note && <span className="italic">— {item.review_note}</span>}
            </div>
            <Button variant="ghost" size="sm" onClick={handleReopen} disabled={isPending} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              {t.admin.unmatchedEmails.reopen}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.admin.unmatchedEmails.reviewNotePlaceholder}
              className="min-h-16 text-sm"
              aria-label={t.admin.unmatchedEmails.reviewNote}
            />
            <div className="flex items-center justify-between gap-3">
              {error && <span className="text-xs text-destructive">{error}</span>}
              <Button size="sm" onClick={handleMarkReviewed} disabled={isPending} className="ml-auto gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isPending ? t.admin.unmatchedEmails.saving : t.admin.unmatchedEmails.markReviewed}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
