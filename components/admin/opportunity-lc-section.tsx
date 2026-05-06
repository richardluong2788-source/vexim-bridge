"use client"

/**
 * L/C & Bank Verification Panel (Ngăn Thẩm định Ngân hàng & L/C)
 *
 * 4-layer protection against fake L/C and risky issuing banks:
 *  1. SWIFT BIC validation + bank lookup
 *  2. Sanctions / blacklist screening
 *  3. Bank tier classification (1-4) with payment recommendation
 *  4. 6-point manual checklist for the L/C document itself
 */

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Search,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Building2,
  FileWarning,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  getLCVerification,
  saveLCVerification,
  lookupBank,
  type BankLookupResult,
} from "@/app/admin/opportunities/lc-actions"
import type { LCVerification } from "@/lib/supabase/types"

interface Props {
  opportunityId: string
  open: boolean
}

type Checklist = {
  received_via_swift: boolean
  bic_matches: boolean
  amount_matches_po: boolean
  description_matches_po: boolean
  shipment_date_reasonable: boolean
  no_soft_clauses: boolean
}

const EMPTY_CHECKLIST: Checklist = {
  received_via_swift: false,
  bic_matches: false,
  amount_matches_po: false,
  description_matches_po: false,
  shipment_date_reasonable: false,
  no_soft_clauses: false,
}

const CHECKLIST_ITEMS: Array<{
  key: keyof Checklist
  title: string
  hint: string
}> = [
  {
    key: "received_via_swift",
    title: "L/C nhận qua SWIFT MT700",
    hint: "Nhận trực tiếp từ ngân hàng VN (VCB/BIDV/Vietinbank), không phải PDF email từ buyer.",
  },
  {
    key: "bic_matches",
    title: "BIC ngân hàng phát hành khớp",
    hint: "Trùng với BIC đã verify ở bước 1.",
  },
  {
    key: "amount_matches_po",
    title: "Số tiền & đơn vị tiền tệ khớp với PO",
    hint: "Currency và amount đúng với Purchase Order đã ký.",
  },
  {
    key: "description_matches_po",
    title: "Mô tả hàng hóa khớp với PO",
    hint: "HS code, packing, specs đúng với PO; không có sai khác có thể bị bank từ chối chứng từ.",
  },
  {
    key: "shipment_date_reasonable",
    title: "Latest shipment date hợp lý",
    hint: "Sau ngày dự kiến đóng hàng tối thiểu 14 ngày để xử lý chứng từ.",
  },
  {
    key: "no_soft_clauses",
    title: "Không có 'soft clause' bất thường",
    hint: "Không có điều khoản yêu cầu chứng từ do buyer ký, hoặc inspection certificate do buyer chỉ định.",
  },
]

function tierColor(tier: number | null | undefined) {
  switch (tier) {
    case 1:
      return "bg-green-50 text-green-900 border-green-200"
    case 2:
      return "bg-amber-50 text-amber-900 border-amber-200"
    case 3:
      return "bg-orange-50 text-orange-900 border-orange-200"
    case 4:
      return "bg-red-50 text-red-900 border-red-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function TierIcon({ tier }: { tier: number | null | undefined }) {
  if (tier === 4) return <ShieldX className="h-4 w-4 text-red-600" />
  if (tier === 3) return <ShieldAlert className="h-4 w-4 text-orange-600" />
  if (tier === 2) return <ShieldAlert className="h-4 w-4 text-amber-600" />
  if (tier === 1) return <ShieldCheck className="h-4 w-4 text-green-600" />
  return <Building2 className="h-4 w-4 text-muted-foreground" />
}

export function OpportunityLCSection({ opportunityId, open }: Props) {
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [data, setData] = useState<LCVerification | null>(null)

  const [bicInput, setBicInput] = useState("")
  const [lookup, setLookup] = useState<BankLookupResult | null>(null)
  const [looking, setLooking] = useState(false)

  const [checklist, setChecklist] = useState<Checklist>(EMPTY_CHECKLIST)
  const [docUrl, setDocUrl] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")

  // Load existing verification when sheet opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getLCVerification(opportunityId)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          toast.error("Không tải được dữ liệu thẩm định L/C")
          return
        }
        const v = res.data
        setData(v)
        if (v) {
          setBicInput(v.bank_bic ?? "")
          setChecklist({
            received_via_swift: v.received_via_swift,
            bic_matches: v.bic_matches,
            amount_matches_po: v.amount_matches_po,
            description_matches_po: v.description_matches_po,
            shipment_date_reasonable: v.shipment_date_reasonable,
            no_soft_clauses: v.no_soft_clauses,
          })
          setDocUrl(v.lc_document_url ?? "")
          setRejectionReason(v.rejection_reason ?? "")
          if (v.bank_bic && v.detected_tier) {
            // Re-hydrate lookup card from snapshot
            setLookup({
              ok: true,
              entry: {
                bic: v.bank_bic,
                bank_name: v.bank_name_snapshot ?? "",
                country_code: "",
                country_name: v.bank_country_snapshot ?? null,
                tier: v.detected_tier,
                is_sanctioned: v.detected_sanctioned ?? false,
                has_correspondent_vn: false,
                notes: null,
                source: null,
                updated_at: v.updated_at,
              },
              tierLabel: "",
              recommendation: v.recommendation ?? "",
            })
          }
        } else {
          setBicInput("")
          setChecklist(EMPTY_CHECKLIST)
          setDocUrl("")
          setRejectionReason("")
          setLookup(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, opportunityId])

  async function handleVerifyBic() {
    const trimmed = bicInput.trim()
    if (!trimmed) {
      toast.error("Nhập BIC/SWIFT của ngân hàng phát hành L/C trước.")
      return
    }
    setLooking(true)
    try {
      const result = await lookupBank(trimmed)
      setLookup(result)
      if (!result.ok) {
        if (result.reason === "invalid_bic") {
          toast.error("BIC không đúng định dạng ISO 9362 (8 hoặc 11 ký tự).")
        } else {
          toast.warning(
            "Không tìm thấy BIC trong cơ sở dữ liệu nội bộ. Cần xác minh thủ công với phòng XNK ngân hàng VN.",
          )
        }
      }
    } finally {
      setLooking(false)
    }
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveLCVerification({
        opportunity_id: opportunityId,
        bank_bic: bicInput.trim() || null,
        ...checklist,
        lc_document_url: docUrl.trim() || null,
        rejection_reason: rejectionReason.trim() || null,
      })
      if (!res.ok) {
        toast.error(res.error || "Không lưu được thẩm định L/C")
        return
      }
      setData(res.data)
      const status = res.data.verification_status
      if (status === "verified") {
        toast.success("Đã verify L/C — an toàn để tiến hành xuống hàng.")
      } else if (status === "rejected") {
        toast.error("Đã ghi nhận trạng thái TỪ CHỐI giao dịch.")
      } else {
        toast.success("Đã lưu tiến độ thẩm định L/C.")
      }
    })
  }

  const allChecksDone = useMemo(
    () => Object.values(checklist).every(Boolean),
    [checklist],
  )
  const isSanctioned = lookup?.ok && lookup.entry.is_sanctioned
  const tier = lookup?.ok ? lookup.entry.tier : null

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Thẩm định Ngân hàng &amp; L/C
          </h3>
          <p className="text-xs text-muted-foreground">
            Xác minh ngân hàng phát hành và tính hợp lệ của L/C trước khi đóng hàng.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Spinner className="h-4 w-4" />
          <span className="text-xs text-muted-foreground ml-2">Đang tải...</span>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 flex flex-col gap-5">
            {/* Layer 1: BIC lookup */}
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="bic">BIC / SWIFT của ngân hàng phát hành</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="bic"
                    value={bicInput}
                    onChange={(e) => setBicInput(e.target.value.toUpperCase())}
                    placeholder="VD: HSBCGB2L hoặc CHASUS33"
                    className="font-mono uppercase"
                    disabled={looking || pending}
                    maxLength={11}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyBic}
                    disabled={looking || pending || !bicInput.trim()}
                    className="shrink-0 gap-1.5"
                  >
                    {looking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Tra cứu
                  </Button>
                </div>
                <FieldDescription>
                  8 hoặc 11 ký tự theo ISO 9362. BIC luôn lấy từ chính ngân hàng phát hành — KHÔNG hỏi
                  buyer.
                </FieldDescription>
              </Field>
            </FieldGroup>

            {/* Lookup result card */}
            {lookup && lookup.ok && (
              <div className={`rounded-lg border p-3 flex flex-col gap-2 ${tierColor(tier)}`}>
                <div className="flex items-start gap-2">
                  <TierIcon tier={tier} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {lookup.entry.bank_name || lookup.entry.bic}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                      <Badge variant="secondary" className="font-mono">
                        {lookup.entry.bic}
                      </Badge>
                      {lookup.entry.country_name && (
                        <span>{lookup.entry.country_name}</span>
                      )}
                      <Badge
                        variant={tier === 4 ? "destructive" : "secondary"}
                        className="font-medium"
                      >
                        Tier {tier}
                      </Badge>
                      {lookup.entry.has_correspondent_vn && (
                        <Badge variant="outline" className="border-current">
                          Có đại lý VN
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {isSanctioned && (
                  <div className="flex items-start gap-2 mt-1 p-2 rounded bg-red-100 border border-red-300 text-red-900">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-xs font-medium leading-relaxed">
                      CẢNH BÁO: Ngân hàng nằm trong danh sách trừng phạt (OFAC/EU/UN). KHÔNG thực
                      hiện giao dịch dưới mọi hình thức.
                    </p>
                  </div>
                )}

                {lookup.recommendation && !isSanctioned && (
                  <p className="text-xs leading-relaxed mt-1">
                    <span className="font-semibold">Khuyến nghị: </span>
                    {lookup.recommendation}
                  </p>
                )}
              </div>
            )}

            {lookup && !lookup.ok && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-amber-900">
                <FileWarning className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 text-xs leading-relaxed">
                  {lookup.reason === "invalid_bic" ? (
                    <>
                      <p className="font-semibold">BIC không đúng định dạng</p>
                      <p>Phải là 8 hoặc 11 ký tự theo ISO 9362 (4 bank + 2 country + 2 location).</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">
                        Không tìm thấy BIC trong cơ sở dữ liệu nội bộ
                      </p>
                      <p>
                        Cần verify thủ công: gọi phòng tài trợ thương mại của VCB/BIDV/Vietinbank
                        hỏi xem có quan hệ đại lý với BIC{" "}
                        <span className="font-mono">{lookup.normalizedBic}</span> không.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Layer 4: 6-point checklist */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">
                Checklist L/C (6 điểm bắt buộc)
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Chỉ tick khi đã tự mắt kiểm tra trên bản L/C nhận qua SWIFT từ ngân hàng VN.
              </p>
              <div className="flex flex-col gap-3">
                {CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checklist[item.key]}
                      onCheckedChange={(v) =>
                        setChecklist((prev) => ({ ...prev, [item.key]: v === true }))
                      }
                      disabled={pending}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {item.hint}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* L/C document URL */}
            <Field>
              <FieldLabel htmlFor="lc-doc">Link L/C đã nhận (tuỳ chọn)</FieldLabel>
              <Input
                id="lc-doc"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="URL Drive/Blob lưu file SWIFT MT700 + bản dịch"
                disabled={pending}
              />
              <FieldDescription>
                Khuyến nghị upload qua Vercel Blob để truy vết audit.
              </FieldDescription>
            </Field>

            {/* Rejection reason (only shown if user wants to add manual notes) */}
            <Field>
              <FieldLabel htmlFor="reject-reason">Ghi chú / Lý do từ chối (nếu có)</FieldLabel>
              <Textarea
                id="reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="VD: Phát hiện soft clause yêu cầu inspection do buyer chỉ định — đã yêu cầu sửa L/C."
                rows={2}
                disabled={pending}
              />
            </Field>

            {/* Status banner */}
            {data && (
              <div
                className={`rounded-lg p-3 flex items-start gap-2 border ${
                  data.verification_status === "verified"
                    ? "bg-green-50 border-green-200 text-green-900"
                    : data.verification_status === "rejected"
                      ? "bg-red-50 border-red-200 text-red-900"
                      : "bg-muted border-border text-foreground"
                }`}
              >
                {data.verification_status === "verified" ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : data.verification_status === "rejected" ? (
                  <ShieldX className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0 text-xs leading-relaxed">
                  <p className="font-semibold">
                    {data.verification_status === "verified" && "Trạng thái: Đã verify"}
                    {data.verification_status === "rejected" && "Trạng thái: Từ chối giao dịch"}
                    {data.verification_status === "pending" && "Trạng thái: Đang thẩm định"}
                  </p>
                  {data.verification_status === "verified" && (
                    <p>
                      An toàn để tiến hành sản xuất / xuống hàng theo điều khoản L/C đã verify.
                    </p>
                  )}
                  {data.verification_status === "pending" && !allChecksDone && (
                    <p>
                      Còn{" "}
                      {Object.values(checklist).filter((v) => !v).length}/6 mục checklist chưa
                      được xác nhận.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={pending}
                className="gap-1.5"
              >
                {pending ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Lưu thẩm định L/C
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
