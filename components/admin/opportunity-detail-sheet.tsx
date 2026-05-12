"use client"

import { useState, useTransition, useEffect, useRef, type FormEvent } from "react"
import { toast } from "sonner"
import {
  Save, X, Target, Package, StickyNote, Sparkles,
  Mail, MessageSquare, BarChart2, DollarSign, ShieldCheck, Landmark,
  ChevronLeft, CheckCircle2, Building2,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { updateOpportunityDetails, suggestClientAction } from "@/app/admin/opportunities/actions"
import { markBuyerRepliesReadAction } from "@/app/admin/opportunities/reply-actions"
import { useTranslation } from "@/components/i18n/language-provider"
import type { OpportunityWithClient } from "@/lib/supabase/types"
import type { Stage } from "@/lib/supabase/types"
import { OpportunityComplianceSection } from "@/components/admin/opportunity-compliance-section"
import { OpportunityFinancialSection } from "@/components/admin/opportunity-financial-section"
import { OpportunityBuyerRepliesSection } from "@/components/admin/opportunity-buyer-replies-section"
import { OpportunityCISection } from "@/components/admin/opportunity-ci-section"
import { OpportunityLCSection } from "@/components/admin/opportunity-lc-section"
import { OpportunityEmailSection } from "@/components/admin/opportunity-email-section"

interface Props {
  opportunity: OpportunityWithClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (updated: Partial<OpportunityWithClient>) => void
}

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const

// All pipeline stages in order
const STAGES: Stage[] = [
  "new", "contacted", "sample_requested", "sample_sent",
  "negotiation", "price_agreed", "production", "shipped", "won", "lost",
]

// Nav sections
type SectionId =
  | "status"
  | "commercial"
  | "email"
  | "replies"
  | "intelligence"
  | "financials"
  | "compliance"
  | "lc"
  | "notes"

interface NavItem {
  id: SectionId
  icon: React.ElementType
  labelKey: string
}

const NAV_ITEMS: NavItem[] = [
  { id: "status",       icon: Target,        labelKey: "sectionStatus" },
  { id: "commercial",   icon: Package,       labelKey: "sectionDeal" },
  { id: "email",        icon: Mail,          labelKey: "sectionEmail" },
  { id: "replies",      icon: MessageSquare, labelKey: "sectionReplies" },
  { id: "intelligence", icon: BarChart2,     labelKey: "sectionCI" },
  { id: "financials",   icon: DollarSign,    labelKey: "sectionFinancials" },
  { id: "compliance",   icon: ShieldCheck,   labelKey: "sectionCompliance" },
  { id: "lc",           icon: Landmark,      labelKey: "sectionLC" },
  { id: "notes",        icon: StickyNote,    labelKey: "sectionInternal" },
]

function stageColor(stage: Stage): string {
  if (stage === "won") return "bg-emerald-500 text-white"
  if (stage === "lost") return "bg-destructive text-white"
  return "bg-primary text-primary-foreground"
}

function stageIndex(stage: Stage): number {
  const flow: Stage[] = [
    "new", "contacted", "sample_requested", "sample_sent",
    "negotiation", "price_agreed", "production", "shipped", "won",
  ]
  const idx = flow.indexOf(stage)
  return idx === -1 ? -1 : idx
}

export function OpportunityDetailSheet({ opportunity, open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation()
  const [pending, startTransition] = useTransition()
  const [aiLoading, setAiLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>("status")
  const emailSectionRef = useRef<HTMLDivElement>(null)
  const [quoteReply, setQuoteReply] = useState<string | undefined>()

  // When the sheet opens for an opportunity, silently mark all its unread
  // buyer replies as read so the kanban badge clears after the AE views it.
  useEffect(() => {
    if (open && opportunity?.id) {
      markBuyerRepliesReadAction(opportunity.id)
    }
  }, [open, opportunity?.id])

  const [formKey, setFormKey] = useState<string | null>(null)
  const [form, setForm] = useState(() => emptyForm())

  if (opportunity && formKey !== opportunity.id) {
    setFormKey(opportunity.id)
    setForm({
      products_interested: opportunity.products_interested ?? "",
      quantity_required: opportunity.quantity_required ?? "",
      target_price_usd: opportunity.target_price_usd?.toString() ?? "",
      price_unit: opportunity.price_unit ?? "",
      incoterms: opportunity.incoterms ?? "",
      payment_terms: opportunity.payment_terms ?? "",
      destination_port: opportunity.destination_port ?? "",
      target_close_date: opportunity.target_close_date ?? "",
      potential_value: opportunity.potential_value?.toString() ?? "",
      next_step: opportunity.next_step ?? "",
      client_action_required: opportunity.client_action_required ?? "",
      notes: opportunity.notes ?? "",
    })
    setActiveSection("status")
  }

  if (!opportunity) return null

  const companyName =
    opportunity.leads?.company_name ??
    opportunity.profiles?.company_name ??
    "—"

  const currentStage: Stage = (opportunity.stage as Stage) ?? "new"
  const stageLabel = t.kanban.stages[currentStage] ?? currentStage
  const activeStageIdx = stageIndex(currentStage)

  async function handleAiSuggest() {
    if (!opportunity) return
    const s = t.admin.clients.oppSheet
    if (!form.next_step.trim()) {
      toast.error(s.aiNeedNextStep)
      return
    }
    setAiLoading(true)
    try {
      const res = await suggestClientAction({
        opportunityId: opportunity.id,
        nextStep: form.next_step,
        incoterms: form.incoterms || null,
        productsInterested: form.products_interested || null,
        paymentTerms: form.payment_terms || null,
        destinationPort: form.destination_port || null,
      })
      if (!res.ok) {
        toast.error(res.error === "missingContext" ? s.aiNeedNextStep : s.aiError)
        return
      }
      setForm((p) => ({ ...p, client_action_required: res.suggestion }))
      toast.success(s.aiSuccess)
    } catch {
      toast.error(t.admin.clients.oppSheet.aiError)
    } finally {
      setAiLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!opportunity) return

    startTransition(async () => {
      const res = await updateOpportunityDetails({
        id: opportunity.id,
        products_interested: form.products_interested,
        quantity_required: form.quantity_required,
        target_price_usd: form.target_price_usd === "" ? null : Number(form.target_price_usd),
        price_unit: form.price_unit,
        incoterms: form.incoterms,
        payment_terms: form.payment_terms,
        destination_port: form.destination_port,
        target_close_date: form.target_close_date,
        potential_value: form.potential_value === "" ? null : Number(form.potential_value),
        next_step: form.next_step,
        client_action_required: form.client_action_required,
        notes: form.notes,
      })

      if (!res.ok) {
        toast.error(
          res.error === "forbidden"
            ? t.admin.clients.oppSheet.errorForbidden
            : t.admin.clients.oppSheet.errorGeneric,
        )
        return
      }

      toast.success(t.admin.clients.oppSheet.success)
      onSaved?.({
        id: opportunity.id,
        products_interested: form.products_interested.trim() || null,
        quantity_required: form.quantity_required.trim() || null,
        target_price_usd: form.target_price_usd === "" ? null : Number(form.target_price_usd),
        price_unit: form.price_unit.trim() || null,
        incoterms: form.incoterms || null,
        payment_terms: form.payment_terms.trim() || null,
        destination_port: form.destination_port.trim() || null,
        target_close_date: form.target_close_date || null,
        potential_value: form.potential_value === "" ? null : Number(form.potential_value),
        next_step: form.next_step.trim() || null,
        client_action_required: form.client_action_required.trim() || null,
        notes: form.notes.trim() || null,
        last_updated: new Date().toISOString(),
      })
      onOpenChange(false)
    })
  }

  const s = t.admin.clients.oppSheet

  // Nav label map using translation keys
  const navLabel: Record<SectionId, string> = {
    status:       s.sectionStatus,
    commercial:   s.sectionDeal,
        email:        t.admin.clients.email?.sectionTitle ?? "Email Buyer",
    replies:      s.sectionReplies ?? "Phản hồi Buyer",
    intelligence: s.sectionCI ?? "Tình báo TM",
    financials:   s.sectionFinancials ?? "Tài chính",
    compliance:   s.sectionCompliance ?? "Tuân thủ",
    lc:           s.sectionLC ?? "L/C & Ngân hàng",
    notes:        s.sectionInternal,
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Wide dialog: 95vw, max 1280px — use !important to override default sm:max-w-sm */}
      <SheetContent className="!w-[95vw] !max-w-[1280px] sm:!max-w-[1280px] p-0 flex flex-col overflow-hidden">

        {/* ── Top header (close button is provided by SheetContent itself) ── */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 pr-12 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-foreground leading-snug">
                {s.title}
              </h2>
              <Badge className={`text-xs font-medium ${stageColor(currentStage)}`}>
                {stageLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.subtitle.replace("{company}", companyName)}
            </p>
          </div>
        </div>

        {/* ── Pipeline stage tracker ───────────────────────────── */}
        {currentStage !== "lost" && (
          <div className="px-6 py-3 border-b border-border bg-muted/40 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max">
              {(["new","contacted","sample_requested","sample_sent","negotiation","price_agreed","production","shipped","won"] as Stage[]).map((stage, idx) => {
                const isDone    = activeStageIdx > idx
                const isCurrent = activeStageIdx === idx
                return (
                  <div key={stage} className="flex items-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className={[
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
                        isDone    ? "bg-primary text-primary-foreground"
                          : isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                          : "bg-muted text-muted-foreground border border-border",
                      ].join(" ")}>
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{idx + 1}</span>}
                      </div>
                      <span className={[
                        "text-[10px] leading-tight text-center max-w-[56px] whitespace-nowrap",
                        isCurrent ? "text-primary font-semibold" : isDone ? "text-primary/70" : "text-muted-foreground",
                      ].join(" ")}>
                        {t.kanban.stages[stage]}
                      </span>
                    </div>
                    {idx < 8 && (
                      <div className={[
                        "w-8 h-px mx-1 mt-[-12px] shrink-0",
                        idx < activeStageIdx ? "bg-primary" : "bg-border",
                      ].join(" ")} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 2-column body ────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left content area */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">

              {/* STATUS */}
              {activeSection === "status" && (
                <section className="space-y-4 max-w-2xl">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    {s.sectionStatus}
                  </h3>
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="next_step">{s.nextStep}</FieldLabel>
                      <Textarea
                        id="next_step"
                        rows={3}
                        value={form.next_step}
                        onChange={(e) => setForm((p) => ({ ...p, next_step: e.target.value }))}
                        placeholder={s.nextStepPlaceholder}
                      />
                      <FieldDescription>{s.nextStepHelp}</FieldDescription>
                    </Field>
                    <Field>
                      <div className="flex items-center justify-between gap-2">
                        <FieldLabel htmlFor="client_action_required" className="m-0">
                          {s.actionRequired}
                        </FieldLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAiSuggest}
                          disabled={aiLoading || pending || !form.next_step.trim()}
                          className="h-7 gap-1.5 px-2 text-xs"
                          title={s.aiHint}
                        >
                          {aiLoading ? (
                            <><Spinner className="h-3 w-3" />{s.aiSuggesting}</>
                          ) : (
                            <><Sparkles className="h-3 w-3" />{s.aiSuggest}</>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        id="client_action_required"
                        rows={3}
                        value={form.client_action_required}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, client_action_required: e.target.value }))
                        }
                        placeholder={s.actionRequiredPlaceholder}
                      />
                      <FieldDescription>{s.actionRequiredHelp}</FieldDescription>
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="potential_value">{s.potentialValue}</FieldLabel>
                        <Input
                          id="potential_value"
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={form.potential_value}
                          onChange={(e) => setForm((p) => ({ ...p, potential_value: e.target.value }))}
                          placeholder="50000"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="target_close_date">{s.targetCloseDate}</FieldLabel>
                        <Input
                          id="target_close_date"
                          type="date"
                          value={form.target_close_date}
                          onChange={(e) => setForm((p) => ({ ...p, target_close_date: e.target.value }))}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </section>
              )}

              {/* COMMERCIAL */}
              {activeSection === "commercial" && (
                <section className="space-y-4 max-w-2xl">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    {s.sectionDeal}
                  </h3>
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="products_interested">{s.productName}</FieldLabel>
                      <Input
                        id="products_interested"
                        value={form.products_interested}
                        onChange={(e) => setForm((p) => ({ ...p, products_interested: e.target.value }))}
                        placeholder={s.productNamePlaceholder}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="quantity_required">{s.quantity}</FieldLabel>
                        <Input
                          id="quantity_required"
                          value={form.quantity_required}
                          onChange={(e) => setForm((p) => ({ ...p, quantity_required: e.target.value }))}
                          placeholder={s.quantityPlaceholder}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="target_price_usd">{s.unitPrice}</FieldLabel>
                        <Input
                          id="target_price_usd"
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={form.target_price_usd}
                          onChange={(e) => setForm((p) => ({ ...p, target_price_usd: e.target.value }))}
                          placeholder="10.50"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="incoterms">{s.incoterms}</FieldLabel>
                        <Select
                          value={form.incoterms || "__none"}
                          onValueChange={(v) => setForm((p) => ({ ...p, incoterms: v === "__none" ? "" : v }))}
                        >
                          <SelectTrigger id="incoterms">
                            <SelectValue placeholder={s.incotermsPlaceholder} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {INCOTERMS.map((inc) => (
                              <SelectItem key={inc} value={inc}>{inc}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="payment_terms">{s.paymentTerms}</FieldLabel>
                        <Input
                          id="payment_terms"
                          value={form.payment_terms}
                          onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))}
                          placeholder={s.paymentTermsPlaceholder}
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="destination_port">{s.destinationPort}</FieldLabel>
                      <Input
                        id="destination_port"
                        value={form.destination_port}
                        onChange={(e) => setForm((p) => ({ ...p, destination_port: e.target.value }))}
                        placeholder={s.destinationPortPlaceholder}
                      />
                    </Field>
                  </FieldGroup>
                </section>
              )}

              {/* EMAIL */}
              {activeSection === "email" && (
                <section ref={emailSectionRef} className="space-y-4">
                  <OpportunityEmailSection 
                    opportunityId={opportunity.id} 
                    open={open}
                    quoteReply={quoteReply}
                    onClearQuote={() => setQuoteReply(undefined)}
                  />
                </section>
              )}

              {/* BUYER REPLIES */}
              {activeSection === "replies" && (
                <section className="space-y-4 max-w-3xl">
                  <OpportunityBuyerRepliesSection 
                    opportunityId={opportunity.id} 
                    open={open}
                    onReplyClick={(replyText) => {
                      setQuoteReply(replyText)
                      setActiveSection("email")
                      // Scroll to email section after state update
                      setTimeout(() => {
                        emailSectionRef.current?.scrollIntoView({ behavior: "smooth" })
                      }, 0)
                    }}
                  />
                </section>
              )}

              {/* INTELLIGENCE */}
              {activeSection === "intelligence" && (
                <section className="space-y-4 max-w-3xl">
                  <OpportunityCISection opportunityId={opportunity.id} open={open} />
                </section>
              )}

              {/* FINANCIALS */}
              {activeSection === "financials" && (
                <section className="space-y-4 max-w-3xl">
                  <OpportunityFinancialSection opportunityId={opportunity.id} open={open} />
                </section>
              )}

              {/* COMPLIANCE */}
              {activeSection === "compliance" && (
                <section className="space-y-4 max-w-3xl">
                  <OpportunityComplianceSection opportunityId={opportunity.id} open={open} />
                </section>
              )}

              {/* LC */}
              {activeSection === "lc" && (
                <section className="space-y-4 max-w-3xl">
                  <OpportunityLCSection opportunityId={opportunity.id} open={open} />
                </section>
              )}

              {/* NOTES */}
              {activeSection === "notes" && (
                <section className="space-y-4 max-w-2xl">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    {s.sectionInternal}
                  </h3>
                  <Field>
                    <FieldLabel htmlFor="notes">{s.notes}</FieldLabel>
                    <Textarea
                      id="notes"
                      rows={5}
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder={s.notesPlaceholder}
                    />
                    <FieldDescription>{s.notesHelp}</FieldDescription>
                  </Field>
                </section>
              )}
            </div>

            {/* Footer: only show Save for sections that have editable form fields */}
            {(activeSection === "status" || activeSection === "commercial" || activeSection === "notes") && (
              <div className="border-t border-border p-4 flex justify-end gap-2 shrink-0 bg-background">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={pending}
                >
                  <X className="h-4 w-4" />
                  {s.cancel}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <><Spinner className="h-4 w-4" />{s.saving}</>
                  ) : (
                    <><Save className="h-4 w-4" />{s.save}</>
                  )}
                </Button>
              </div>
            )}
          </form>

          {/* Right sidebar nav */}
          <nav className="w-48 shrink-0 border-l border-border bg-muted/20 flex flex-col overflow-y-auto">

            {/* Client info card */}
            <div className="px-3 py-3 border-b border-border bg-muted/40 shrink-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Client</span>
              </div>
              <p className="text-xs font-semibold text-foreground leading-snug truncate" title={opportunity.profiles?.company_name ?? undefined}>
                {opportunity.profiles?.company_name ?? "—"}
              </p>
              {opportunity.profiles?.industry && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={opportunity.profiles.industry}>
                  {opportunity.profiles.industry}
                </p>
              )}
              {opportunity.profiles?.full_name && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={opportunity.profiles.full_name}>
                  {opportunity.profiles.full_name}
                </p>
              )}
            </div>

            <div className="flex flex-col py-3 gap-0.5 flex-1">
            {NAV_ITEMS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={[
                  "flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors w-full rounded-none",
                  activeSection === id
                    ? "bg-background text-primary font-medium border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{navLabel[id]}</span>
                {activeSection === id && (
                  <ChevronLeft className="h-3.5 w-3.5 ml-auto shrink-0 text-primary" />
                )}
              </button>
              ))}
            </div>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function emptyForm() {
  return {
    products_interested: "",
    quantity_required: "",
    target_price_usd: "",
    price_unit: "",
    incoterms: "",
    payment_terms: "",
    destination_port: "",
    target_close_date: "",
    potential_value: "",
    next_step: "",
    client_action_required: "",
    notes: "",
  }
}
