"use client"

/**
 * Sprint D — UI for logging + viewing buyer replies on an opportunity.
 *
 * Admin pastes an English buyer email → we send it to the AI classifier
 * server action → the server returns a structured intent/translation/next-step,
 * which we render in a timeline list.
 *
 * This component lives inside the OpportunityDetailSheet so it can hydrate
 * on sheet-open (not on every mount).
 */

import { useEffect, useState, useTransition } from "react"
import {
  MessageSquareText,
  Plus,
  Sparkles,
  AlertTriangle,
  DollarSign,
  Package,
  HandCoins,
  HandshakeIcon,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  addBuyerReplyAction,
  listBuyerRepliesAction,
} from "@/app/admin/opportunities/reply-actions"
import type { BuyerReply, BuyerReplyIntent } from "@/lib/supabase/types"

interface Props {
  opportunityId: string
  open: boolean
}

const INTENT_META: Record<
  BuyerReplyIntent,
  {
    icon: typeof DollarSign
    tone: "price" | "sample" | "objection" | "closing" | "general"
  }
> = {
  price_request: { icon: DollarSign, tone: "price" },
  sample_request: { icon: Package, tone: "sample" },
  objection: { icon: AlertTriangle, tone: "objection" },
  closing_signal: { icon: HandshakeIcon, tone: "closing" },
  general: { icon: MessageSquareText, tone: "general" },
}

const TONE_CLASS: Record<string, string> = {
  price: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  sample: "bg-chart-1/10 text-chart-1 border-chart-1/30",
  objection: "bg-destructive/10 text-destructive border-destructive/30",
  closing: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  general: "bg-muted text-muted-foreground border-border",
}

export function OpportunityBuyerRepliesSection({ opportunityId, open }: Props) {
  const { t } = useTranslation()
  const s = t.admin.buyerReplies
  const [replies, setReplies] = useState<BuyerReply[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [raw, setRaw] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    listBuyerRepliesAction(opportunityId)
      .then((res) => {
        if (cancelled) return
        setReplies(res.replies)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, opportunityId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = raw.trim()
    if (!trimmed) {
      toast.error(s.errorEmpty)
      return
    }
    startTransition(async () => {
      const res = await addBuyerReplyAction({
        opportunityId,
        rawContentEn: trimmed,
      })
      if (!res.ok) {
        toast.error(res.error === "empty" ? s.errorEmpty : s.errorGeneric)
        return
      }
      toast.success(s.success)
      setReplies((prev) => [res.reply, ...prev])
      setRaw("")
      setShowForm(false)
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            {s.sectionTitle}
          </h3>
          {replies.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {replies.length}
            </Badge>
          )}
        </div>
        {!showForm && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowForm(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {s.addReply}
          </Button>
        )}
      </header>

      {showForm && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {s.formTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {s.formHint}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reply-raw">{s.pasteLabel}</Label>
                <Textarea
                  id="reply-raw"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={6}
                  placeholder={s.pastePlaceholder}
                  disabled={pending}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false)
                    setRaw("")
                  }}
                  disabled={pending}
                >
                  {s.cancel}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !raw.trim()}
                  className="gap-1.5"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {s.analyzing}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      {s.analyze}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          {s.loading}
        </p>
      ) : replies.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          {s.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {replies.map((reply) => (
            <ReplyCard key={reply.id} reply={reply} labels={s} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ReplyCard({
  reply,
  labels,
}: {
  reply: BuyerReply
  labels: ReturnType<typeof useTranslation>["t"]["admin"]["buyerReplies"]
}) {
  const [expanded, setExpanded] = useState(false)
  const intent = reply.ai_intent ?? "general"
  const meta = INTENT_META[intent]
  const Icon = meta.icon
  const toneClass = TONE_CLASS[meta.tone]
  const confidencePct =
    reply.ai_confidence != null
      ? Math.round(reply.ai_confidence * 100)
      : null

  return (
    <li>
      <Card className="overflow-hidden">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                  toneClass,
                )}
              >
                <Icon className="h-3 w-3" />
                {labels.intents[intent]}
              </span>
              {confidencePct != null && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {labels.confidence} {confidencePct}%
                </span>
              )}
            </div>
            <time className="text-[11px] text-muted-foreground shrink-0">
              {new Date(reply.received_at).toLocaleString()}
            </time>
          </div>

          {reply.ai_summary && (
            <p className="text-sm text-foreground leading-relaxed">
              <span className="font-medium">{labels.summary}: </span>
              {reply.ai_summary}
            </p>
          )}

          {reply.ai_suggested_next_step && (
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 flex items-start gap-2">
              <HandCoins className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/90 leading-relaxed">
                <span className="font-semibold text-primary">
                  {labels.nextStep}:{" "}
                </span>
                {reply.ai_suggested_next_step}
              </p>
            </div>
          )}

          {reply.translated_vi && (
            <details
              open={expanded}
              onToggle={(e) =>
                setExpanded((e.target as HTMLDetailsElement).open)
              }
              className="text-xs"
            >
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
                {expanded ? labels.hideTranslation : labels.showTranslation}
              </summary>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {labels.originalEn}
                  </p>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {reply.raw_content}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {labels.vietnameseVi}
                  </p>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {reply.translated_vi}
                  </p>
                </div>
              </div>
            </details>
          )}

          {!reply.translated_vi && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
                {labels.originalEn}
              </summary>
              <p className="mt-2 text-xs whitespace-pre-wrap leading-relaxed rounded-md bg-muted/40 p-3">
                {reply.raw_content}
              </p>
            </details>
          )}
        </CardContent>
      </Card>
    </li>
  )
}
