"use client"

/**
 * Financial Snapshot section inside the Opportunity Detail Sheet.
 *
 * Captures the Sprint B data per SOP §2.4:
 *   - cost_price_supplier     — cost VXB pays the client
 *   - suggested_selling_price — quote going to the buyer
 *   - quantity_units + unit_label
 * and shows a LIVE profit margin preview before the admin saves.
 *
 * The actual persisted `profit_margin_usd` is a Postgres GENERATED column,
 * so after save we re-fetch to pick up the authoritative value.
 */
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { DollarSign, Save, TrendingUp, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  updateDealFinancialsAction,
  getDealFinancials,
} from "@/app/admin/opportunities/financial-actions"
import { useTranslation } from "@/components/i18n/language-provider"

interface Props {
  opportunityId: string
  open: boolean
}

type DealFinancials = Awaited<ReturnType<typeof getDealFinancials>>

export function OpportunityFinancialSection({ opportunityId, open }: Props) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState<DealFinancials>(null)
  const [loading, setLoading] = useState(false)
  const [saving, startSaving] = useTransition()

  const [cost, setCost] = useState("")
  const [selling, setSelling] = useState("")
  const [qty, setQty] = useState("")
  const [unitLabel, setUnitLabel] = useState("")
  const [invoiceValue, setInvoiceValue] = useState("")
  const [commissionRate, setCommissionRate] = useState("")

  // Load financials on open — scope to opportunity so switching cards refreshes.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const data = await getDealFinancials(opportunityId)
      if (cancelled) return
      setLoaded(data ?? null)
      setCost(data?.cost_price_supplier?.toString() ?? "")
      setSelling(data?.suggested_selling_price?.toString() ?? "")
      setQty(data?.quantity_units?.toString() ?? "")
      setUnitLabel(data?.unit_label ?? "")
      setInvoiceValue(data?.invoice_value?.toString() ?? "")
      setCommissionRate(data?.commission_rate?.toString() ?? "")
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [opportunityId, open])

  // Live margin calculation using parsed inputs — mirrors the SQL formula:
  //   (selling - cost) * COALESCE(quantity, 1)
  const invoiceValueN = invoiceValue === "" ? null : Number(invoiceValue)
  const rateN = commissionRate === "" ? null : Number(commissionRate)
  // Preview hoa hồng: nếu admin chưa nhập % thì dùng mặc định từ gói hợp đồng.
  const effRate = rateN ?? loaded?.default_commission_rate ?? null
  const commissionPreview =
    invoiceValueN != null && effRate != null
      ? (invoiceValueN * effRate) / 100
      : null
  const costN = cost === "" ? null : Number(cost)
  const sellingN = selling === "" ? null : Number(selling)
  const qtyN = qty === "" ? null : Number(qty)
  const canCompute =
    costN !== null &&
    sellingN !== null &&
    !Number.isNaN(costN) &&
    !Number.isNaN(sellingN)
  const unitMargin = canCompute ? sellingN! - costN! : null
  const totalMargin = canCompute ? unitMargin! * (qtyN ?? 1) : null
  const marginPct =
    canCompute && sellingN! > 0 ? (unitMargin! / sellingN!) * 100 : null

  const s = t.admin.clients.financial

  function handleSave() {
    startSaving(async () => {
      const res = await updateDealFinancialsAction({
        opportunityId,
        costPriceSupplier: costN,
        suggestedSellingPrice: sellingN,
        quantityUnits: qtyN,
        unitLabel: unitLabel.trim() || null,
        invoiceValue: invoiceValue === "" ? null : Number(invoiceValue),
        commissionRate: commissionRate === "" ? null : Number(commissionRate),
      })
      if (!res.ok) {
        toast.error(s.errorSave)
        return
      }
      toast.success(s.saved)
      // Re-fetch so the GENERATED margin value is pulled from Postgres.
      const data = await getDealFinancials(opportunityId)
      setLoaded(data ?? null)
    })
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {s.sectionTitle}
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Spinner className="h-4 w-4" />
        </div>
      ) : (
        <FieldGroup className="gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="cost_price_supplier">{s.costPrice}</FieldLabel>
              <Input
                id="cost_price_supplier"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="8.50"
              />
              <FieldDescription>{s.costPriceHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="suggested_selling_price">
                {s.sellingPrice}
              </FieldLabel>
              <Input
                id="suggested_selling_price"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={selling}
                onChange={(e) => setSelling(e.target.value)}
                placeholder="11.00"
              />
              <FieldDescription>{s.sellingPriceHint}</FieldDescription>
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-4">
            <Field>
              <FieldLabel htmlFor="quantity_units">{s.quantity}</FieldLabel>
              <Input
                id="quantity_units"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="5000"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="unit_label">{s.unit}</FieldLabel>
              <Input
                id="unit_label"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="kg"
              />
            </Field>
          </div>

          {/* Hoa hồng thành công — FOB × %, mặc định theo gói hợp đồng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="invoice_value">{s.invoiceValue}</FieldLabel>
              <Input
                id="invoice_value"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={invoiceValue}
                onChange={(e) => setInvoiceValue(e.target.value)}
                placeholder="50000"
              />
              <FieldDescription>{s.invoiceValueHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="commission_rate">{s.commissionRate}</FieldLabel>
              <Input
                id="commission_rate"
                type="number"
                min={0}
                max={100}
                step="any"
                inputMode="decimal"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder={
                  loaded?.default_commission_rate != null
                    ? String(loaded.default_commission_rate)
                    : "5"
                }
              />
              <FieldDescription>
                {s.commissionRateHint}
                {loaded?.default_commission_rate != null &&
                  ` (${s.commissionPlanDefault}: ${loaded.default_commission_rate}%)`}
              </FieldDescription>
            </Field>
          </div>

          {/* Hoa hồng live preview */}
          <div className="rounded-lg border border-teal-600/30 bg-teal-600/5 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {s.commissionPreview}
              </p>
              {commissionPreview != null ? (
                <p className="text-lg font-bold tabular-nums text-teal-700">
                  ${commissionPreview.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({invoiceValueN!.toLocaleString("en-US")} × {effRate}%)
                  </span>
                </p>
              ) : loaded?.commission_amount != null ? (
                <p className="text-sm font-semibold tabular-nums text-teal-700">
                  {s.commissionSaved}: $
                  {loaded.commission_amount.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {s.invoiceValueHint}
                </p>
              )}
            </div>
          </div>

          {/* Live preview card */}
          <div
            className={cn(
              "rounded-lg border p-4",
              canCompute && totalMargin !== null && totalMargin >= 0
                ? "border-primary/30 bg-primary/5"
                : canCompute && totalMargin !== null && totalMargin < 0
                  ? "border-destructive/40 bg-destructive/10"
                  : "border-border bg-muted/30",
            )}
          >
            <div className="flex items-start gap-3">
              <TrendingUp
                className={cn(
                  "h-5 w-5 shrink-0 mt-0.5",
                  canCompute && totalMargin !== null && totalMargin < 0
                    ? "text-destructive"
                    : "text-primary",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {s.preview}
                </p>
                {canCompute ? (
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {s.unitMargin}
                      </p>
                      <p
                        className={cn(
                          "font-semibold tabular-nums",
                          unitMargin! < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        ${unitMargin!.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {s.totalMargin}
                      </p>
                      <p
                        className={cn(
                          "font-semibold tabular-nums",
                          totalMargin! < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        ${totalMargin!.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {s.marginPct}
                      </p>
                      <p
                        className={cn(
                          "font-semibold tabular-nums",
                          marginPct !== null && marginPct < 0
                            ? "text-destructive"
                            : "text-foreground",
                        )}
                      >
                        {marginPct !== null ? `${marginPct.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.previewHint}
                  </p>
                )}

                {loaded?.profit_margin_usd != null && canCompute && (
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                    <Info className="h-3 w-3" />
                    {s.savedMargin}:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      ${Number(loaded.profit_margin_usd).toFixed(2)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  {s.saving}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {s.save}
                </>
              )}
            </Button>
          </div>
        </FieldGroup>
      )}
    </section>
  )
}
