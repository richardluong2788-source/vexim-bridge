"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, ClipboardCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { upsertAssessment, type AssessmentInput } from "@/lib/assessment/actions"
import { GRADE_LABELS, GRADE_COLORS, type ScoreCategory } from "@/lib/assessment/scoring"
import type { ClientFactoryAssessment } from "@/lib/supabase/types"

interface AdminFactoryAssessmentProps {
  clientId: string
  existing?: ClientFactoryAssessment | null
  fdaNumber: string | null
  fdaExpiresAt: string | null
  moq: string | null
  leadTime: string | null
  productionCapacity: string | null
}

const QUALITY_SYSTEMS = ["HACCP", "GMP", "ISO22000", "SOP", "QC", "other"]
const OEM_ODM = ["OEM", "ODM", "Private Label", "none"]
const EXPORT_MARKETS = ["US", "EU", "JP", "KR", "CN", "ASEAN", "ME", "other"]
const TRACEABILITY = ["lot", "input", "finished", "recall", "batch-lot", "none"]
const AUDIT_READINESS = ["onsite", "online", "not-ready"]
const INCOTERMS = ["EXW", "FOB", "CIF"]
const COMMITMENTS = ["priority", "cooperation", "accuracy"]
const WATER_SOURCES = ["municipal", "well", "filtered", "other"]

const LBL: Record<string, string> = {
  HACCP: "HACCP", GMP: "GMP", ISO22000: "ISO 22000", SOP: "SOP nội bộ",
  QC: "Quy trình kiểm soát chất lượng", other: "Khác",
  OEM: "OEM", ODM: "ODM", "Private Label": "Private Label", none: "Không triển khai / Chưa áp dụng",
  US: "Hoa Kỳ", EU: "EU", JP: "Nhật Bản", KR: "Hàn Quốc", CN: "Trung Quốc",
  ASEAN: "ASEAN", ME: "Trung Đông",
  lot: "Hồ sơ truy xuất theo từng lô hàng", input: "Hồ sơ nguyên liệu đầu vào",
  finished: "Hồ sơ thành phẩm", recall: "Quy trình thu hồi sản phẩm",
  "batch-lot": "Mã Batch/Lot",
  onsite: "Sẵn sàng tiếp đón Buyer đến khảo sát nhà máy",
  online: "Sẵn sàng thực hiện Audit Online",
  "not-ready": "Chưa sẵn sàng",
  EXW: "Báo giá EXW", FOB: "Báo giá FOB", CIF: "Báo giá CIF",
  priority: "Cam kết ưu tiên nguồn lực để triển khai dự án cùng Vexim",
  cooperation: "Cam kết phối hợp đầy đủ trong suốt quá trình phát triển thị trường",
  accuracy: "Đồng ý cung cấp đầy đủ thông tin trung thực và chịu trách nhiệm về tính chính xác",
  municipal: "Nước máy / thủy cục",
  well: "Nước giếng khoan (đã xử lý)",
  filtered: "Hệ thống lọc RO / xử lý nội bộ",
}

function toggle(arr: string[], v: string, single?: string[]) {
  if (single && single.includes(v)) {
    // mutually exclusive group: chon 1 thi bo cac gia tri single khac
    const without = arr.filter((x) => !single.includes(x))
    return arr.includes(v) ? without : [...without, v]
  }
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function AdminFactoryAssessment({
  clientId,
  existing,
  fdaNumber,
  fdaExpiresAt,
  moq: initMoq,
  leadTime: initLeadTime,
  productionCapacity: initCapacity,
}: AdminFactoryAssessmentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [qualitySystems, setQualitySystems] = useState<string[]>(existing?.quality_systems ?? [])
  const [qualityOther, setQualityOther] = useState(existing?.quality_systems_other ?? "")
  const [oemOdm, setOemOdm] = useState<string[]>(existing?.oem_odm ?? [])
  const [companyScale, setCompanyScale] = useState(existing?.company_scale ?? "")
  const [exportSince, setExportSince] = useState(existing?.export_since_year?.toString() ?? "")
  const [exportMarkets, setExportMarkets] = useState<string[]>(existing?.export_markets ?? [])
  const [exportMarketsOther, setExportMarketsOther] = useState(existing?.export_markets_other ?? "")
  const [traceability, setTraceability] = useState<string[]>(existing?.traceability ?? [])
  const [auditReadiness, setAuditReadiness] = useState<string[]>(existing?.audit_readiness ?? [])
  const [auditOwner, setAuditOwner] = useState(existing?.audit_owner ?? "")
  const [incoterms, setIncoterms] = useState<string[]>(existing?.incoterms ?? [])
  const [paymentPolicy, setPaymentPolicy] = useState(existing?.payment_policy ?? "")
  const [oemPolicy, setOemPolicy] = useState(existing?.oem_policy ?? "")
  const [odmPolicy, setOdmPolicy] = useState(existing?.odm_policy ?? "")
  const [hasExportDept, setHasExportDept] = useState<string>(
    existing?.has_export_dept == null ? "" : existing.has_export_dept ? "yes" : "no"
  )
  const [hasEnglishStaff, setHasEnglishStaff] = useState<string>(
    existing?.has_english_staff == null ? "" : existing.has_english_staff ? "yes" : "no"
  )
  const [pricingMaker, setPricingMaker] = useState(existing?.pricing_decision_maker ?? "")
  const [commitments, setCommitments] = useState<string[]>(existing?.commitments ?? [])
  const [priority, setPriority] = useState(existing?.project_priority ?? "")
  const [moq, setMoq] = useState(initMoq ?? "")
  const [leadTime, setLeadTime] = useState(initLeadTime ?? "")
  const [capacity, setCapacity] = useState(initCapacity ?? "")

  const [staffEngineers, setStaffEngineers] = useState(
    existing?.staff_engineers_count?.toString() ?? ""
  )
  const [staffWorkers, setStaffWorkers] = useState(
    existing?.staff_workers_count?.toString() ?? ""
  )
  const [workHoursStart, setWorkHoursStart] = useState(existing?.work_hours_start ?? "")
  const [workHoursEnd, setWorkHoursEnd] = useState(existing?.work_hours_end ?? "")
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(
    existing?.work_days_per_week?.toString() ?? ""
  )
  const [foodSafetyTraining, setFoodSafetyTraining] = useState<string>(
    existing?.food_safety_training_regular == null
      ? ""
      : existing.food_safety_training_regular
        ? "yes"
        : "no"
  )
  const [equipmentCalibration, setEquipmentCalibration] = useState<string>(
    existing?.equipment_calibration_regular == null
      ? ""
      : existing.equipment_calibration_regular
        ? "yes"
        : "no"
  )
  const [waterSource, setWaterSource] = useState<string[]>(existing?.water_source ?? [])
  const [waterSourceOther, setWaterSourceOther] = useState(existing?.water_source_other ?? "")
  const [waterTesting, setWaterTesting] = useState<string>(
    existing?.water_testing == null ? "" : existing.water_testing ? "yes" : "no"
  )
  const [nearPollution, setNearPollution] = useState<string>(
    existing?.near_pollution_source == null ? "" : existing.near_pollution_source ? "yes" : "no"
  )
  const [pollutionNote, setPollutionNote] = useState(existing?.pollution_source_note ?? "")

  const score = existing?.score_total ?? null
  const grade = existing?.score_grade ?? null
  const breakdown = (existing?.score_breakdown as unknown as ScoreCategory[]) ?? []

  function handleSave() {
    startTransition(async () => {
      const input: AssessmentInput = {
        quality_systems: qualitySystems,
        quality_systems_other: qualityOther || null,
        oem_odm: oemOdm,
        company_scale: companyScale || null,
        export_since_year: exportSince ? parseInt(exportSince, 10) : null,
        export_markets: exportMarkets,
        export_markets_other: exportMarketsOther || null,
        traceability,
        audit_readiness: auditReadiness,
        audit_owner: auditOwner || null,
        incoterms,
        payment_policy: paymentPolicy || null,
        oem_policy: oemPolicy || null,
        odm_policy: odmPolicy || null,
        has_export_dept: hasExportDept === "" ? null : hasExportDept === "yes",
        has_english_staff: hasEnglishStaff === "" ? null : hasEnglishStaff === "yes",
        pricing_decision_maker: pricingMaker || null,
        commitments,
        project_priority: priority || null,
        moq: moq || null,
        lead_time_days: leadTime || null,
        production_capacity: capacity || null,
        staff_engineers_count: staffEngineers ? parseInt(staffEngineers, 10) : null,
        staff_workers_count: staffWorkers ? parseInt(staffWorkers, 10) : null,
        work_hours_start: workHoursStart || null,
        work_hours_end: workHoursEnd || null,
        work_days_per_week: workDaysPerWeek ? parseInt(workDaysPerWeek, 10) : null,
        food_safety_training_regular: foodSafetyTraining === "" ? null : foodSafetyTraining === "yes",
        equipment_calibration_regular:
          equipmentCalibration === "" ? null : equipmentCalibration === "yes",
        water_source: waterSource,
        water_source_other: waterSourceOther || null,
        water_testing: waterTesting === "" ? null : waterTesting === "yes",
        near_pollution_source: nearPollution === "" ? null : nearPollution === "yes",
        pollution_source_note: pollutionNote || null,
      }
      const res = await upsertAssessment(clientId, input)
      if (res.success) {
        toast.success("Đã lưu đánh giá và tính lại điểm")
        router.refresh()
      } else {
        toast.error(res.error ?? "Lưu thất bại")
      }
    })
  }

  const fdaExpired = fdaExpiresAt ? new Date(fdaExpiresAt).getTime() < Date.now() : false

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Đánh giá năng lực nhà máy
            </CardTitle>
            <CardDescription>
              Form đánh giá nội bộ Vexim (mục 6–15). Một phần hiển thị công khai cho buyer.
            </CardDescription>
          </div>
          {grade && (
            <div className="text-right">
              <Badge variant="outline" className={`text-base px-3 py-1 ${GRADE_COLORS[grade]}`}>
                {grade} · {score}/100
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">{GRADE_LABELS[grade]}</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Diem chi tiet */}
        {breakdown.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium mb-3">Điểm theo hạng mục</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {breakdown.map((c) => (
                <div key={c.key} className="rounded-md bg-background border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-sm font-semibold">
                    {c.score}
                    <span className="text-muted-foreground font-normal">/{c.max}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Muc 6: QLCL */}
        <section className="space-y-3">
          <h3 className="font-semibold">6. Hệ thống quản lý chất lượng & ATTP đang áp dụng</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {QUALITY_SYSTEMS.map((q) => (
              <label key={q} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={qualitySystems.includes(q)}
                  onCheckedChange={() => setQualitySystems(toggle(qualitySystems, q))}
                />
                {LBL[q]}
              </label>
            ))}
          </div>
          {qualitySystems.includes("other") && (
            <Input
              placeholder="Chứng nhận khác..."
              value={qualityOther}
              onChange={(e) => setQualityOther(e.target.value)}
            />
          )}
        </section>

        {/* Muc 7: OEM/ODM */}
        <section className="space-y-3">
          <h3 className="font-semibold">7. Năng lực OEM / ODM</h3>
          <div className="flex flex-wrap gap-4">
            {OEM_ODM.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={oemOdm.includes(o)}
                  onCheckedChange={() => setOemOdm(toggle(oemOdm, o, ["none"]))}
                />
                {LBL[o]}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Quy mô doanh nghiệp (nhân sự, diện tích)</Label>
            <Input
              placeholder="VD: 120 nhân sự, 5.000 m²"
              value={companyScale}
              onChange={(e) => setCompanyScale(e.target.value)}
            />
          </div>
        </section>

        {/* Muc 8: Kinh nghiem XK */}
        <section className="space-y-3">
          <h3 className="font-semibold">8. Kinh nghiệm xuất khẩu</h3>
          <div className="space-y-2">
            <Label>Đã xuất khẩu từ năm</Label>
            <Input
              type="number"
              placeholder="VD: 2018"
              value={exportSince}
              onChange={(e) => setExportSince(e.target.value)}
              className="max-w-[200px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Các thị trường đã xuất khẩu</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {EXPORT_MARKETS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={exportMarkets.includes(m)}
                    onCheckedChange={() => setExportMarkets(toggle(exportMarkets, m))}
                  />
                  {LBL[m]}
                </label>
              ))}
            </div>
            {exportMarkets.includes("other") && (
              <Input
                placeholder="Thị trường khác..."
                value={exportMarketsOther}
                onChange={(e) => setExportMarketsOther(e.target.value)}
              />
            )}
          </div>
        </section>

        {/* Muc 9: Truy xuat nguon goc */}
        <section className="space-y-3">
          <h3 className="font-semibold">9. Hệ thống truy xuất nguồn gốc</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {TRACEABILITY.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={traceability.includes(t)}
                  onCheckedChange={() => setTraceability(toggle(traceability, t, ["none"]))}
                />
                {LBL[t]}
              </label>
            ))}
          </div>
        </section>

        {/* Muc 10: FDA (dong bo, chi doc) */}
        <section className="space-y-3">
          <h3 className="font-semibold">10. Đăng ký FDA</h3>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            {fdaNumber ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={fdaExpired ? GRADE_COLORS.D : GRADE_COLORS.A}>
                  {fdaExpired ? "Hết hạn" : "Còn hạn"}
                </Badge>
                <span className="font-medium">{fdaNumber}</span>
                {fdaExpiresAt && (
                  <span className="text-muted-foreground">
                    · Hết hạn {new Date(fdaExpiresAt).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Chưa có số FDA — cập nhật ở tab Tuân thủ.</p>
            )}
          </div>
        </section>

        {/* Muc 11: Nhan su, gio lam viec, ATTP/thiet bi, nguon nuoc, vi tri nha may */}
        <section className="space-y-3">
          <h3 className="font-semibold">11. Nhân sự, giờ làm việc & rủi ro lao động / môi trường</h3>
          <p className="text-xs text-muted-foreground">
            Dùng để đánh giá rủi ro lao động cưỡng bức, an toàn thực phẩm và môi trường sản xuất.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Số lượng kỹ sư / nhân viên kỹ thuật</Label>
              <Input
                type="number"
                min={0}
                placeholder="VD: 8"
                value={staffEngineers}
                onChange={(e) => setStaffEngineers(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Số lượng công nhân sản xuất</Label>
              <Input
                type="number"
                min={0}
                placeholder="VD: 120"
                value={staffWorkers}
                onChange={(e) => setStaffWorkers(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Giờ bắt đầu ca làm việc</Label>
              <Input
                type="time"
                value={workHoursStart}
                onChange={(e) => setWorkHoursStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Giờ kết thúc ca làm việc</Label>
              <Input
                type="time"
                value={workHoursEnd}
                onChange={(e) => setWorkHoursEnd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Số ngày làm việc / tuần</Label>
              <Input
                type="number"
                min={1}
                max={7}
                placeholder="VD: 6"
                value={workDaysPerWeek}
                onChange={(e) => setWorkDaysPerWeek(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Đào tạo / tập huấn ATTP định kỳ</Label>
              <RadioGroup
                value={foodSafetyTraining}
                onValueChange={setFoodSafetyTraining}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="yes" /> Có
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="no" /> Không
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Kiểm tra / kiểm định máy móc định kỳ</Label>
              <RadioGroup
                value={equipmentCalibration}
                onValueChange={setEquipmentCalibration}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="yes" /> Có
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="no" /> Không
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nguồn nước sử dụng trong sản xuất</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {WATER_SOURCES.map((w) => (
                <label key={w} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={waterSource.includes(w)}
                    onCheckedChange={() => setWaterSource(toggle(waterSource, w))}
                  />
                  {LBL[w]}
                </label>
              ))}
            </div>
            {waterSource.includes("other") && (
              <Input
                placeholder="Nguồn nước khác..."
                value={waterSourceOther}
                onChange={(e) => setWaterSourceOther(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nguồn nước có được kiểm định định kỳ</Label>
              <RadioGroup value={waterTesting} onValueChange={setWaterTesting} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="yes" /> Có
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="no" /> Không
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Nhà máy có gần nguồn ô nhiễm (KCN nặng, bãi rác, sông ô nhiễm...)</Label>
              <RadioGroup value={nearPollution} onValueChange={setNearPollution} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="yes" /> Có
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="no" /> Không
                </label>
              </RadioGroup>
            </div>
          </div>
          {nearPollution === "yes" && (
            <div className="space-y-2">
              <Label>Ghi chú vị trí / nguồn ô nhiễm gần nhà máy</Label>
              <Textarea
                value={pollutionNote}
                onChange={(e) => setPollutionNote(e.target.value)}
                rows={2}
                placeholder="VD: cách khu công nghiệp X 500m..."
              />
            </div>
          )}
        </section>

        {/* Muc 12: Buyer Audit */}
        <section className="space-y-3">
          <h3 className="font-semibold">12. Khả năng tiếp đón Buyer Audit</h3>
          <div className="space-y-2">
            {AUDIT_READINESS.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={auditReadiness.includes(a)}
                  onCheckedChange={() => setAuditReadiness(toggle(auditReadiness, a, ["not-ready"]))}
                />
                {LBL[a]}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Người phụ trách Audit</Label>
            <Input
              placeholder="Họ tên / chức danh"
              value={auditOwner}
              onChange={(e) => setAuditOwner(e.target.value)}
            />
          </div>
        </section>

        {/* Muc 13: Nang luc thuong mai */}
        <section className="space-y-3">
          <h3 className="font-semibold">13. Năng lực thương mại</h3>
          <div className="flex flex-wrap gap-4">
            {INCOTERMS.map((i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={incoterms.includes(i)}
                  onCheckedChange={() => setIncoterms(toggle(incoterms, i))}
                />
                {LBL[i]}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>MOQ (đồng bộ hồ sơ công khai)</Label>
              <Input value={moq} onChange={(e) => setMoq(e.target.value)} placeholder="VD: 500 kg" />
            </div>
            <div className="space-y-2">
              <Label>Lead Time (đồng bộ)</Label>
              <Input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="VD: 15 ngày" />
            </div>
            <div className="space-y-2">
              <Label>Công suất (đồng bộ)</Label>
              <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="VD: 10 tấn/tháng" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Chính sách thanh toán</Label>
              <Textarea value={paymentPolicy} onChange={(e) => setPaymentPolicy(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Chính sách OEM</Label>
              <Textarea value={oemPolicy} onChange={(e) => setOemPolicy(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Chính sách ODM</Label>
              <Textarea value={odmPolicy} onChange={(e) => setOdmPolicy(e.target.value)} rows={2} />
            </div>
          </div>
        </section>

        {/* Muc 14: Nhan su */}
        <section className="space-y-3">
          <h3 className="font-semibold">14. Nhân sự phụ trách dự án</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Có bộ phận xuất khẩu</Label>
              <RadioGroup value={hasExportDept} onValueChange={setHasExportDept} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="yes" /> Có
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="no" /> Không
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Có nhân sự giao tiếp tiếng Anh</Label>
              <RadioGroup value={hasEnglishStaff} onValueChange={setHasEnglishStaff} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="yes" /> Có
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="no" /> Không
                </label>
              </RadioGroup>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Người có quyền quyết định báo giá</Label>
            <Input
              placeholder="Họ tên / chức danh"
              value={pricingMaker}
              onChange={(e) => setPricingMaker(e.target.value)}
            />
          </div>
        </section>

        {/* Muc 15: Cam ket */}
        <section className="space-y-3">
          <h3 className="font-semibold">15. Cam kết triển khai dự án</h3>
          <div className="space-y-2">
            {COMMITMENTS.map((c) => (
              <label key={c} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={commitments.includes(c)}
                  onCheckedChange={() => setCommitments(toggle(commitments, c))}
                  className="mt-0.5"
                />
                {LBL[c]}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Mức độ ưu tiên dự án</Label>
            <RadioGroup value={priority} onValueChange={setPriority} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="high" /> Cao
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="medium" /> Trung bình
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="low" /> Thấp
              </label>
            </RadioGroup>
          </div>
        </section>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu đánh giá & tính điểm
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
