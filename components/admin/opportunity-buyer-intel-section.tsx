"use client"

/**
 * Buyer Intel Section — ghi nhận thông tin AE thu được sau khi liên lạc
 * trực tiếp với buyer (giá, thanh toán, hồ sơ, kiểm nghiệm).
 *
 * Hệ thống ImportYeti chỉ phân tích tốt lịch sử nhập khẩu QUÁ KHỨ của buyer.
 * Thông tin "sống" — giá đã trao đổi, chính sách thanh toán, hồ sơ/chứng từ
 * buyer yêu cầu, kiểm nghiệm — chỉ AE mới biết được sau khi gọi/chat với
 * buyer. AE gõ ghi chú tự do ở đây; AI phân loại + tóm tắt + gợi ý field cụ
 * thể có thể áp vào deal, nhưng AE luôn phải tự xác nhận trước khi áp dụng —
 * AI không tự động ghi đè dữ liệu thương mại.
 */
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  NotebookPen,
  Sparkles,
  Trash2,
  DollarSign,
  CreditCard,
  FileText,
  FlaskConical,
  MessageSquareText,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  createBuyerIntelNote,
  listBuyerIntelNotes,
  applyBuyerIntelToOpportunity,
  deleteBuyerIntelNote,
  type BuyerIntelNote,
} from "@/app/admin/opportunities/buyer-intel-actions"

interface Props {
  opportunityId: string
  open: boolean
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  pricing: DollarSign,
  payment: CreditCard,
  documents: FileText,
  testing: FlaskConical,
  general: MessageSquareText,
}

const CATEGORY_COLOR: Record<string, string> = {
  pricing: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  payment: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  documents: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  testing: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  general: "bg-muted text-muted-foreground border-border",
}

export function OpportunityBuyerIntelSection({ opportunityId, open }: Props) {
  const { t } = useTranslation()
  const s = t.admin.clients.buyerIntel

  const [notes, setNotes] = useState<BuyerIntelNote[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState("")
  const [submitting, startSubmitting] = useTransition()
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    listBuyerIntelNotes(opportunityId)
      .then((res) => {
        if (cancelled) return
        if (res.ok) setNotes(res.notes ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, opportunityId])

  function handleSubmit() {
    if (!note.trim()) {
      toast.error(s.errorEmpty)
      return
    }
    startSubmitting(async () => {
      const res = await createBuyerIntelNote(opportunityId, note)
      if (!res.ok || !res.note) {
        toast.error(res.error === "forbidden" ? s.errorForbidden : s.errorGeneric)
        return
      }
      setNotes((prev) => [res.note!, ...prev])
      setNote("")
    })
  }

  async function handleApply(n: BuyerIntelNote) {
    const suggested = n.ai_extracted?.suggestedFieldUpdates
    if (!suggested) {
      toast.info(s.noSuggestions)
      return
    }
    const fields: Record<string, number | string | null> = {}
    if (suggested.targetPriceUsd !== null && suggested.targetPriceUsd !== undefined) {
      fields.target_price_usd = suggested.targetPriceUsd
    }
    if (suggested.priceUnit) fields.price_unit = suggested.priceUnit
    if (suggested.incoterms) fields.incoterms = suggested.incoterms
    if (suggested.paymentTerms) fields.payment_terms = suggested.paymentTerms

    if (Object.keys(fields).length === 0) {
      toast.info(s.noSuggestions)
      return
    }

    setApplyingId(n.id)
    const res = await applyBuyerIntelToOpportunity(n.id, opportunityId, fields)
    setApplyingId(null)
    if (!res.ok) {
      toast.error(s.errorGeneric)
      return
    }
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, applied_to_opportunity: true } : x)))
    toast.success(s.applySuccess)
  }

  async function handleDelete(n: BuyerIntelNote) {
    if (!window.confirm(s.confirmDelete)) return
    setDeletingId(n.id)
    const res = await deleteBuyerIntelNote(n.id, opportunityId)
    setDeletingId(null)
    if (!res.ok) {
      toast.error(s.errorGeneric)
      return
    }
    setNotes((prev) => prev.filter((x) => x.id !== n.id))
    toast.success(s.deleted)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <NotebookPen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{s.sectionTitle}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{s.sectionDesc}</p>
        </div>
      </div>

      <Field>
        <Textarea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={s.notePlaceholder}
          disabled={submitting}
        />
        <FieldDescription className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {s.sectionDesc}
        </FieldDescription>
      </Field>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting} size="sm">
          {submitting ? (
            <>
              <Spinner className="h-4 w-4 mr-2" />
              {s.submitting}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {s.submit}
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3 pt-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{s.empty}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.emptyDesc}</p>
          </div>
        ) : (
          notes.map((n) => {
            const Icon = CATEGORY_ICON[n.category] ?? MessageSquareText
            const suggested = n.ai_extracted?.suggestedFieldUpdates
            const hasSuggestions =
              suggested &&
              (suggested.targetPriceUsd !== null ||
                suggested.priceUnit ||
                suggested.incoterms ||
                suggested.paymentTerms)

            return (
              <Card key={n.id} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={`gap-1 ${CATEGORY_COLOR[n.category]}`}>
                      <Icon className="h-3 w-3" />
                      {s.categories[n.category as keyof typeof s.categories] ?? n.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(n.created_at).toLocaleString("vi-VN")}
                    </span>
                  </div>

                  {n.ai_summary && (
                    <p className="text-sm text-foreground font-medium leading-relaxed">{n.ai_summary}</p>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-border pl-3">
                    {n.raw_note}
                  </p>

                  {hasSuggestions && (
                    <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-foreground">{s.suggestedFields}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {suggested.targetPriceUsd !== null && suggested.targetPriceUsd !== undefined && (
                          <span>
                            {s.fieldPrice}: <strong className="text-foreground">{suggested.targetPriceUsd}</strong>
                          </span>
                        )}
                        {suggested.priceUnit && (
                          <span>
                            {s.fieldPriceUnit}: <strong className="text-foreground">{suggested.priceUnit}</strong>
                          </span>
                        )}
                        {suggested.incoterms && (
                          <span>
                            {s.fieldIncoterms}: <strong className="text-foreground">{suggested.incoterms}</strong>
                          </span>
                        )}
                        {suggested.paymentTerms && (
                          <span>
                            {s.fieldPaymentTerms}:{" "}
                            <strong className="text-foreground">{suggested.paymentTerms}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {n.applied_to_opportunity ? (
                      <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-500/20 bg-emerald-500/10">
                        <CheckCircle2 className="h-3 w-3" />
                        {s.applied}
                      </Badge>
                    ) : hasSuggestions ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApply(n)}
                        disabled={applyingId === n.id}
                      >
                        {applyingId === n.id ? (
                          <Spinner className="h-3.5 w-3.5 mr-1.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {applyingId === n.id ? s.applying : s.applyButton}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(n)}
                      disabled={deletingId === n.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
