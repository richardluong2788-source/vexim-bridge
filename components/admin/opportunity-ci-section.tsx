"use client"

/**
 * Commercial Intelligence Panel (Ngăn Tình báo Thương mại)
 *
 * Displays verified commercial intelligence data for an opportunity.
 * This is filled in by Lead Researcher/Account Executive to prove
 * the buyer meets the import history criterion.
 *
 * Shows full trade intelligence data including:
 * - HS Code & Products
 * - Supply Chain (Top suppliers, countries)
 * - Quantitative Data (shipments, TEU, peak months)
 * - Logistics (ports, containers)
 * - Priority rating
 */

import { useEffect, useState, useTransition } from "react"
import { 
  BarChart3, 
  Edit2, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle2,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  Anchor,
  Container,
  Star,
  Globe2,
  Ship,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/components/i18n/language-provider"
import { getCIByOpportunityId, createOrUpdateCI } from "@/app/admin/opportunities/ci-actions"
import type { CommercialIntelligence } from "@/lib/supabase/types"

interface LeadData {
  hs_code: string | null
  purchase_history: string | null
  competitors: string | null
  peak_months: string | null
  main_product: string | null
  secondary_hs_codes: string | null
  bol_description: string | null
  top_suppliers: { name: string; country: string | null }[] | null
  main_import_countries: string | null
  origin_ports: string | null
  destination_ports: string | null
  container_types: string | null
  priority_rating: number | null
  total_shipments: number | null
  avg_teu_per_month: number | null
  top_low_months: string | null
}

interface Props {
  opportunityId: string
  open: boolean
}

export function OpportunityCISection({ opportunityId, open }: Props) {
  const { t } = useTranslation()
  const [ci, setCi] = useState<CommercialIntelligence | null>(null)
  const [leadData, setLeadData] = useState<LeadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  // Form state
  const [form, setForm] = useState({
    main_hs_code: "",
    import_history_summary: "",
    main_competitors: "",
  })

  // Load CI data when sheet opens
  useEffect(() => {
    if (!open) return
    let cancelled = false

    setLoading(true)
    getCIByOpportunityId(opportunityId)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          toast.error("Failed to load commercial intelligence")
          return
        }
        setCi(res.ci)
        setLeadData(res.leadData ?? null)
        
        if (res.ci) {
          // Use existing CI data
          setForm({
            main_hs_code: res.ci.main_hs_code || "",
            import_history_summary: res.ci.import_history_summary || "",
            main_competitors: res.ci.main_competitors || "",
          })
        } else if (res.leadData) {
          // Pre-fill from lead data (LR input)
          const historyParts = []
          if (res.leadData.purchase_history) historyParts.push(res.leadData.purchase_history)
          if (res.leadData.peak_months) historyParts.push(`Tháng cao điểm: ${res.leadData.peak_months}`)
          
          setForm({
            main_hs_code: res.leadData.hs_code || "",
            import_history_summary: historyParts.join("\n") || "",
            main_competitors: res.leadData.competitors || "",
          })
        }
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
    startTransition(async () => {
      const res = await createOrUpdateCI({
        opportunityId,
        main_hs_code: form.main_hs_code.trim() || null,
        import_history_summary: form.import_history_summary.trim() || null,
        main_competitors: form.main_competitors.trim() || null,
      })

      if (!res.ok) {
        toast.error("Failed to save commercial intelligence")
        return
      }

      setCi(res.ci)
      setEditing(false)
      toast.success("Commercial intelligence saved successfully")
    })
  }

  const s = t.admin?.ci || {
    sectionTitle: "Tình báo Thương mại",
    sectionSubtitle: "Được xác minh bởi Bên A trước khi bàn giao",
    mainHSCode: "Mã HS Code chính",
    mainHSCodeHelp: "Mã thuế quan hài hòa từ hồ sơ hải quan",
    importHistory: "Tóm tắt lịch sử nhập khẩu",
    importHistoryHelp: "Mô tả về mô hình và khối lượng nhập khẩu của buyer",
    mainCompetitors: "Đối thủ cạnh tranh chính",
    mainCompetitorsHelp: "Các nhà cung cấp/đối thủ chính mà buyer hiện đang sử dụng",
    edit: "Chỉnh sửa",
    save: "Lưu",
    cancel: "Hủy",
    saving: "Đang lưu...",
    loading: "Đang tải...",
    noData: "Chưa có dữ liệu tình báo thương mại",
    verified: "Đã xác minh bởi",
  }

  // Check if buyer has VN supplier
  const hasVNSupplier = leadData?.top_suppliers?.some(
    (s) => s.country?.toLowerCase().includes("vietnam") || s.country?.toLowerCase().includes("viet nam") || s.country?.toLowerCase() === "vn"
  )

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{s.sectionTitle}</h3>
            <p className="text-xs text-muted-foreground">{s.sectionSubtitle}</p>
          </div>
        </div>
        {!editing && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="gap-1.5"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {s.edit}
          </Button>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Spinner className="h-4 w-4" />
          <span className="text-xs text-muted-foreground ml-2">{s.loading}</span>
        </div>
      ) : editing ? (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="main_hs_code">{s.mainHSCode}</FieldLabel>
                  <Input
                    id="main_hs_code"
                    value={form.main_hs_code}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, main_hs_code: e.target.value }))
                    }
                    placeholder="e.g. 0801.32, 0801.22"
                    disabled={pending}
                  />
                  <FieldDescription>{s.mainHSCodeHelp}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="import_history">{s.importHistory}</FieldLabel>
                  <Textarea
                    id="import_history"
                    value={form.import_history_summary}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, import_history_summary: e.target.value }))
                    }
                    placeholder="e.g. Nhập 50+ container/năm hạt điều từ Việt Nam..."
                    rows={3}
                    disabled={pending}
                  />
                  <FieldDescription>{s.importHistoryHelp}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="main_competitors">{s.mainCompetitors}</FieldLabel>
                  <Textarea
                    id="main_competitors"
                    value={form.main_competitors}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, main_competitors: e.target.value }))
                    }
                    placeholder="e.g. Visimex (Vietnam), Olam (Singapore)"
                    rows={3}
                    disabled={pending}
                  />
                  <FieldDescription>{s.mainCompetitorsHelp}</FieldDescription>
                </Field>
              </FieldGroup>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={pending}
                >
                  <X className="h-4 w-4" />
                  {s.cancel}
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? (
                    <>
                      <Spinner className="h-3.5 w-3.5" />
                      {s.saving}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {s.save}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : ci ? (
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900">Dữ liệu CI đã xác minh</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Thương vụ này đã có tình báo thương mại được xác minh.
                </p>
              </div>
            </div>

            {ci.main_hs_code && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {s.mainHSCode}
                </p>
                <Badge variant="secondary" className="font-mono">
                  {ci.main_hs_code}
                </Badge>
              </div>
            )}

            {ci.import_history_summary && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {s.importHistory}
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {ci.import_history_summary}
                </p>
              </div>
            )}

            {ci.main_competitors && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {s.mainCompetitors}
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {ci.main_competitors}
                </p>
              </div>
            )}

            {!ci.main_hs_code &&
              !ci.import_history_summary &&
              !ci.main_competitors && (
                <p className="text-xs text-muted-foreground py-2">{s.noData}</p>
              )}
          </CardContent>
        </Card>
      ) : leadData && (leadData.hs_code || leadData.purchase_history || leadData.main_product) ? (
        // Show lead data as pre-filled (from LR input) - needs verification
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-100 border border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">Dữ liệu từ Lead Researcher</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Thông tin này được LR nhập khi tạo buyer. Click &quot;Chỉnh sửa&quot; để xác minh và lưu.
                </p>
              </div>
            </div>

            {/* VN Supplier Badge */}
            {hasVNSupplier && (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Đã có supplier VN
                </Badge>
              </div>
            )}

            {/* HS Code & Products Section */}
            <Card className="border-border shadow-none">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
                  <Package className="h-3.5 w-3.5 text-chart-2" />
                  Mã HS & Sản phẩm
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 flex flex-col gap-2">
                {leadData.hs_code && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">HS chính:</span>
                    {leadData.hs_code.split(",").map((code, i) => (
                      <Badge key={i} variant="secondary" className="font-mono text-xs">
                        {code.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
                {leadData.main_product && (
                  <div className="text-sm">
                    <span className="text-xs text-muted-foreground">Sản phẩm chính: </span>
                    <span className="font-medium">{leadData.main_product}</span>
                  </div>
                )}
                {leadData.secondary_hs_codes && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">HS phụ:</span>
                    {leadData.secondary_hs_codes.split(",").map((code, i) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        {code.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
                {leadData.bol_description && (
                  <div className="mt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                      <FileText className="h-3 w-3" /> Mô tả BOL mẫu
                    </span>
                    <p className="text-xs text-foreground/80 italic line-clamp-2">
                      {leadData.bol_description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supply Chain Section */}
            {(leadData.top_suppliers?.length || leadData.main_import_countries) && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-chart-3" />
                    Chuỗi cung ứng
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 flex flex-col gap-2">
                  {leadData.top_suppliers && leadData.top_suppliers.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Top suppliers:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {leadData.top_suppliers.slice(0, 5).map((supplier, i) => (
                          <Badge 
                            key={i} 
                            variant={
                              supplier.country?.toLowerCase().includes("vietnam") || 
                              supplier.country?.toLowerCase().includes("viet nam") ||
                              supplier.country?.toLowerCase() === "vn"
                                ? "default" 
                                : "outline"
                            }
                            className={`text-xs font-normal ${
                              supplier.country?.toLowerCase().includes("vietnam") || 
                              supplier.country?.toLowerCase().includes("viet nam") ||
                              supplier.country?.toLowerCase() === "vn"
                                ? "bg-green-600 hover:bg-green-700 text-white" 
                                : ""
                            }`}
                          >
                            {supplier.name}
                            {supplier.country && ` (${supplier.country})`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {leadData.main_import_countries && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Quốc gia NK chính:</span>
                      <span>{leadData.main_import_countries}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quantitative Data Section */}
            <Card className="border-border shadow-none">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-chart-1" />
                  Dữ liệu định lượng
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {leadData.total_shipments && (
                    <div className="flex items-center gap-2">
                      <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tổng lô hàng:</span>
                      <span className="font-medium">{leadData.total_shipments.toLocaleString()}</span>
                    </div>
                  )}
                  {leadData.avg_teu_per_month && (
                    <div className="flex items-center gap-2">
                      <Container className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">TEU/tháng:</span>
                      <span className="font-medium">{leadData.avg_teu_per_month.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-border grid grid-cols-2 gap-2">
                  {leadData.peak_months && (
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-chart-4" /> Tháng cao điểm
                      </span>
                      <span className="text-sm">{leadData.peak_months}</span>
                    </div>
                  )}
                  {leadData.top_low_months && (
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-chart-5" /> Tháng thấp điểm
                      </span>
                      <span className="text-sm">{leadData.top_low_months}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Logistics Section */}
            {(leadData.origin_ports || leadData.destination_ports || leadData.container_types) && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
                    <Anchor className="h-3.5 w-3.5 text-chart-4" />
                    Logistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 flex flex-col gap-2 text-sm">
                  {leadData.origin_ports && (
                    <div>
                      <span className="text-xs text-muted-foreground">Cảng xuất: </span>
                      <span>{leadData.origin_ports}</span>
                    </div>
                  )}
                  {leadData.destination_ports && (
                    <div>
                      <span className="text-xs text-muted-foreground">Cảng đích: </span>
                      <span>{leadData.destination_ports}</span>
                    </div>
                  )}
                  {leadData.container_types && (
                    <div>
                      <span className="text-xs text-muted-foreground">Loại container: </span>
                      <span>{leadData.container_types}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Priority & History Section */}
            <Card className="border-border shadow-none">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-yellow-500" />
                  Ghi chú & Mức ưu tiên
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 flex flex-col gap-2">
                {leadData.priority_rating && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mức độ ưu tiên:</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3.5 w-3.5 ${
                            star <= (leadData.priority_rating ?? 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {leadData.purchase_history && (
                  <div>
                    <span className="text-xs text-muted-foreground">Lịch sử mua hàng:</span>
                    <p className="text-sm mt-0.5">{leadData.purchase_history}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">{s.noData}</p>
            <p className="text-xs text-amber-700 mt-1">
              Click &quot;Chỉnh sửa&quot; để thêm dữ liệu tình báo thương mại cho thương vụ này.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
