"use client"

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"
import { Save, X, Target, Package, CalendarDays, StickyNote, Sparkles } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
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
import { updateOpportunityDetails, suggestClientAction } from "@/app/admin/opportunities/actions"
import { useTranslation } from "@/components/i18n/language-provider"
import type { OpportunityWithClient } from "@/lib/supabase/types"
import { OpportunityComplianceSection } from "@/components/admin/opportunity-compliance-section"
import { OpportunityFinancialSection } from "@/components/admin/opportunity-financial-section"
import { OpportunityBuyerRepliesSection } from "@/components/admin/opportunity-buyer-replies-section"
import { OpportunityCISection } from "@/components/admin/opportunity-ci-section"

interface Props {
  opportunity: OpportunityWithClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (updated: Partial<OpportunityWithClient>) => void
}

const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const

export function OpportunityDetailSheet({ opportunity, open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation()
  const [pending, startTransition] = useTransition()
  const [aiLoading, setAiLoading] = useState(false)
  // Controlled form state keyed by opportunity id so re-opening a different
  // card resets correctly without stale values from the previous one.
  const [formKey, setFormKey] = useState<string | null>(null)
  const [form, setForm] = useState(() => emptyForm())

  // Reset form whenever the open opportunity changes
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
  }

  if (!opportunity) return null

  const companyName =
    opportunity.leads?.company_name ??
    opportunity.profiles?.company_name ??
    "—"

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
          res.error === "forbidden" ? t.admin.clients.oppSheet.errorForbidden : t.admin.clients.oppSheet.errorGeneric,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle className="text-lg">{s.title}</SheetTitle>
          <SheetDescription>{s.subtitle.replace("{company}", companyName)}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Section 1: Status & expectations (shown to client) */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{s.sectionStatus}</h3>
              </div>
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
                        <>
                          <Spinner className="h-3 w-3" />
                          {s.aiSuggesting}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          {s.aiSuggest}
                        </>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="potential_value">{s.potentialValue}</FieldLabel>
                    <Input
                      id="potential_value"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={form.potential_value}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, potential_value: e.target.value }))
                      }
                      placeholder="50000"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="target_close_date">
                      <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                      {s.targetCloseDate}
                    </FieldLabel>
                    <Input
                      id="target_close_date"
                      type="date"
                      value={form.target_close_date}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, target_close_date: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              </FieldGroup>
            </section>

            {/* Section 2: Commercial details */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{s.sectionDeal}</h3>
              </div>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="products_interested">{s.productName}</FieldLabel>
                  <Input
                    id="products_interested"
                    value={form.products_interested}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, products_interested: e.target.value }))
                    }
                    placeholder={s.productNamePlaceholder}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="quantity_required">{s.quantity}</FieldLabel>
                    <Input
                      id="quantity_required"
                      value={form.quantity_required}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, quantity_required: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setForm((p) => ({ ...p, target_price_usd: e.target.value }))
                      }
                      placeholder="10.50"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="incoterms">{s.incoterms}</FieldLabel>
                    <Select
                      value={form.incoterms || "__none"}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, incoterms: v === "__none" ? "" : v }))
                      }
                    >
                      <SelectTrigger id="incoterms">
                        <SelectValue placeholder={s.incotermsPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {INCOTERMS.map((inc) => (
                          <SelectItem key={inc} value={inc}>
                            {inc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="payment_terms">{s.paymentTerms}</FieldLabel>
                    <Input
                      id="payment_terms"
                      value={form.payment_terms}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, payment_terms: e.target.value }))
                      }
                      placeholder={s.paymentTermsPlaceholder}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="destination_port">{s.destinationPort}</FieldLabel>
                  <Input
                    id="destination_port"
                    value={form.destination_port}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, destination_port: e.target.value }))
                    }
                    placeholder={s.destinationPortPlaceholder}
                  />
                </Field>
              </FieldGroup>
            </section>

            {/* Section 2.3: Buyer replies (SOP Phase 2.2) */}
            <OpportunityBuyerRepliesSection
              opportunityId={opportunity.id}
              open={open}
            />

            {/* Section 2.3.5: Commercial Intelligence (Ngăn Tình báo) */}
            <OpportunityCISection
              opportunityId={opportunity.id}
              open={open}
            />

            {/* Section 2.4: Deal Financials (SOP §2.4) */}
            <OpportunityFinancialSection
              opportunityId={opportunity.id}
              open={open}
            />

            {/* Section 2.5: Closing & Compliance (SOP Phase 3) */}
            <OpportunityComplianceSection
              opportunityId={opportunity.id}
              open={open}
            />

            {/* Section 3: Internal notes */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{s.sectionInternal}</h3>
              </div>
              <Field>
                <FieldLabel htmlFor="notes">{s.notes}</FieldLabel>
                <Textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={s.notesPlaceholder}
                />
                <FieldDescription>{s.notesHelp}</FieldDescription>
              </Field>
            </section>
          </div>

          <SheetFooter className="border-t border-border p-4 flex-row justify-end gap-2">
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
                <>
                  <Spinner className="h-4 w-4" />
                  {s.saving}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {s.save}
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
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
