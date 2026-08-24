"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  ASSESSMENT_LABELS,
  AUDIT_READINESS,
  COMMITMENTS,
  EXPORT_MARKETS,
  FDA_STATUS,
  INCOTERMS,
  OEM_ODM,
  QUALITY_SYSTEMS,
  TRACEABILITY,
  WATER_SOURCES,
  toggleAssessmentValue,
  type FactoryCapabilityAnswers,
} from "@/lib/assessment/constants"

interface FactoryCapabilityStepProps {
  values: FactoryCapabilityAnswers
  onChange: (patch: Partial<FactoryCapabilityAnswers>) => void
}

function YesNo({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-4">
      <label className="flex items-center gap-2 text-sm">
        <RadioGroupItem value="yes" /> Có
      </label>
      <label className="flex items-center gap-2 text-sm">
        <RadioGroupItem value="no" /> Không
      </label>
    </RadioGroup>
  )
}

export function FactoryCapabilityStep({
  values: v,
  onChange,
}: FactoryCapabilityStepProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 1 (muc 6): He thong quan ly chat luong & ATTP */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          1. Hệ thống quản lý chất lượng &amp; ATTP đang áp dụng
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUALITY_SYSTEMS.map((q) => (
            <label key={q} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.quality_systems.includes(q)}
                onCheckedChange={() =>
                  onChange({
                    quality_systems: toggleAssessmentValue(v.quality_systems, q),
                  })
                }
              />
              {ASSESSMENT_LABELS[q]}
            </label>
          ))}
        </div>
        {v.quality_systems.includes("other") && (
          <Input
            placeholder="Chứng nhận khác..."
            value={v.quality_systems_other}
            onChange={(e) => onChange({ quality_systems_other: e.target.value })}
          />
        )}
      </section>

      {/* 2 (muc 7): OEM/ODM */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          2. Năng lực OEM / ODM
        </h3>
        <div className="flex flex-wrap gap-4">
          {OEM_ODM.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.oem_odm.includes(o)}
                onCheckedChange={() =>
                  onChange({ oem_odm: toggleAssessmentValue(v.oem_odm, o, ["none"]) })
                }
              />
              {ASSESSMENT_LABELS[o]}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyScale">Quy mô doanh nghiệp (nhân sự, diện tích)</Label>
          <Input
            id="companyScale"
            placeholder="VD: 120 nhân sự, 5.000 m²"
            value={v.company_scale}
            onChange={(e) => onChange({ company_scale: e.target.value })}
          />
        </div>
      </section>

      {/* 3 (muc 8): Kinh nghiem xuat khau */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">3. Kinh nghiệm xuất khẩu</h3>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exportSince">Đã xuất khẩu từ năm</Label>
          <Input
            id="exportSince"
            type="number"
            placeholder="VD: 2018"
            value={v.export_since_year}
            onChange={(e) => onChange({ export_since_year: e.target.value })}
            className="max-w-[200px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Các thị trường đã xuất khẩu</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPORT_MARKETS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={v.export_markets.includes(m)}
                  onCheckedChange={() =>
                    onChange({ export_markets: toggleAssessmentValue(v.export_markets, m) })
                  }
                />
                {ASSESSMENT_LABELS[m]}
              </label>
            ))}
          </div>
          {v.export_markets.includes("other") && (
            <Input
              placeholder="Thị trường khác..."
              value={v.export_markets_other}
              onChange={(e) => onChange({ export_markets_other: e.target.value })}
            />
          )}
        </div>
      </section>

      {/* 4 (muc 9): Truy xuat nguon goc */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">4. Hệ thống truy xuất nguồn gốc</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TRACEABILITY.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.traceability.includes(t)}
                onCheckedChange={() =>
                  onChange({ traceability: toggleAssessmentValue(v.traceability, t, ["none"]) })
                }
              />
              {ASSESSMENT_LABELS[t]}
            </label>
          ))}
        </div>
      </section>

      {/* 5 (muc 10): Dang ky FDA */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">5. Đăng ký FDA</h3>
        <RadioGroup
          value={v.fda_status}
          onValueChange={(val) => onChange({ fda_status: val })}
          className="flex flex-wrap gap-4"
        >
          {FDA_STATUS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={s} /> {ASSESSMENT_LABELS[s]}
            </label>
          ))}
        </RadioGroup>
        {v.fda_status === "valid" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fdaNumber">Số đăng ký FDA</Label>
              <Input
                id="fdaNumber"
                placeholder="VD: 12345678901"
                value={v.fda_number}
                onChange={(e) => onChange({ fda_number: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fdaExpiresAt">Ngày hết hạn</Label>
              <Input
                id="fdaExpiresAt"
                type="date"
                value={v.fda_expires_at}
                onChange={(e) => onChange({ fda_expires_at: e.target.value })}
              />
            </div>
          </div>
        )}
      </section>

      {/* 6 (muc 11): Nhan su, gio lam viec & rui ro lao dong / moi truong */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          6. Nhân sự, giờ làm việc &amp; rủi ro lao động / môi trường
        </h3>
        <p className="text-xs text-muted-foreground">
          Dùng để đánh giá rủi ro lao động cưỡng bức, an toàn thực phẩm và môi trường sản xuất.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="staffEngineers">Số lượng kỹ sư / nhân viên kỹ thuật</Label>
            <Input
              id="staffEngineers"
              type="number"
              min={0}
              placeholder="VD: 8"
              value={v.staff_engineers_count}
              onChange={(e) => onChange({ staff_engineers_count: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staffWorkers">Số lượng công nhân sản xuất</Label>
            <Input
              id="staffWorkers"
              type="number"
              min={0}
              placeholder="VD: 120"
              value={v.staff_workers_count}
              onChange={(e) => onChange({ staff_workers_count: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="workHoursStart">Giờ bắt đầu ca làm việc</Label>
            <Input
              id="workHoursStart"
              type="time"
              value={v.work_hours_start}
              onChange={(e) => onChange({ work_hours_start: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workHoursEnd">Giờ kết thúc ca làm việc</Label>
            <Input
              id="workHoursEnd"
              type="time"
              value={v.work_hours_end}
              onChange={(e) => onChange({ work_hours_end: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workDaysPerWeek">Số ngày làm việc / tuần</Label>
            <Input
              id="workDaysPerWeek"
              type="number"
              min={1}
              max={7}
              placeholder="VD: 6"
              value={v.work_days_per_week}
              onChange={(e) => onChange({ work_days_per_week: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Đào tạo / tập huấn ATTP định kỳ</Label>
            <YesNo
              value={v.food_safety_training_regular}
              onChange={(val) => onChange({ food_safety_training_regular: val })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Kiểm tra / kiểm định máy móc định kỳ</Label>
            <YesNo
              value={v.equipment_calibration_regular}
              onChange={(val) => onChange({ equipment_calibration_regular: val })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Nguồn nước sử dụng trong sản xuất</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WATER_SOURCES.map((w) => (
              <label key={w} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={v.water_source.includes(w)}
                  onCheckedChange={() =>
                    onChange({ water_source: toggleAssessmentValue(v.water_source, w) })
                  }
                />
                {ASSESSMENT_LABELS[w]}
              </label>
            ))}
          </div>
          {v.water_source.includes("other") && (
            <Input
              placeholder="Nguồn nước khác..."
              value={v.water_source_other}
              onChange={(e) => onChange({ water_source_other: e.target.value })}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Nguồn nước có được kiểm định định kỳ</Label>
            <YesNo value={v.water_testing} onChange={(val) => onChange({ water_testing: val })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Nhà máy có gần nguồn ô nhiễm (KCN nặng, bãi rác, sông ô nhiễm...)</Label>
            <YesNo
              value={v.near_pollution_source}
              onChange={(val) => onChange({ near_pollution_source: val })}
            />
          </div>
        </div>
        {v.near_pollution_source === "yes" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="pollutionNote">Ghi chú vị trí / nguồn ô nhiễm gần nhà máy</Label>
            <Textarea
              id="pollutionNote"
              rows={2}
              placeholder="VD: cách khu công nghiệp X 500m..."
              value={v.pollution_source_note}
              onChange={(e) => onChange({ pollution_source_note: e.target.value })}
            />
          </div>
        )}
      </section>

      {/* 7 (muc 12): Buyer Audit */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">7. Khả năng tiếp đón Buyer Audit</h3>
        <div className="flex flex-col gap-2">
          {AUDIT_READINESS.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.audit_readiness.includes(a)}
                onCheckedChange={() =>
                  onChange({
                    audit_readiness: toggleAssessmentValue(v.audit_readiness, a, ["not-ready"]),
                  })
                }
              />
              {ASSESSMENT_LABELS[a]}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="auditOwner">Người phụ trách Audit</Label>
          <Input
            id="auditOwner"
            placeholder="Họ tên / chức danh"
            value={v.audit_owner}
            onChange={(e) => onChange({ audit_owner: e.target.value })}
          />
        </div>
      </section>

      {/* 8 (muc 13): Nang luc thuong mai */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">8. Năng lực thương mại</h3>
        <div className="flex flex-wrap gap-4">
          {INCOTERMS.map((i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.incoterms.includes(i)}
                onCheckedChange={() =>
                  onChange({ incoterms: toggleAssessmentValue(v.incoterms, i) })
                }
              />
              {ASSESSMENT_LABELS[i]}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="paymentPolicy">Chính sách thanh toán</Label>
            <Textarea
              id="paymentPolicy"
              rows={2}
              value={v.payment_policy}
              onChange={(e) => onChange({ payment_policy: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="oemPolicy">Chính sách OEM</Label>
            <Textarea
              id="oemPolicy"
              rows={2}
              value={v.oem_policy}
              onChange={(e) => onChange({ oem_policy: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="odmPolicy">Chính sách ODM</Label>
            <Textarea
              id="odmPolicy"
              rows={2}
              value={v.odm_policy}
              onChange={(e) => onChange({ odm_policy: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* 9 (muc 14): Nhan su phu trach du an */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">9. Nhân sự phụ trách dự án</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Có bộ phận xuất khẩu</Label>
            <YesNo value={v.has_export_dept} onChange={(val) => onChange({ has_export_dept: val })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Có nhân sự giao tiếp tiếng Anh</Label>
            <YesNo
              value={v.has_english_staff}
              onChange={(val) => onChange({ has_english_staff: val })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pricingMaker">Người có quyền quyết định báo giá</Label>
          <Input
            id="pricingMaker"
            placeholder="Họ tên / chức danh"
            value={v.pricing_decision_maker}
            onChange={(e) => onChange({ pricing_decision_maker: e.target.value })}
          />
        </div>
      </section>

      {/* 10 (muc 15): Cam ket trien khai du an */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">10. Cam kết triển khai dự án</h3>
        <div className="flex flex-col gap-2">
          {COMMITMENTS.map((c) => (
            <label key={c} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={v.commitments.includes(c)}
                onCheckedChange={() =>
                  onChange({ commitments: toggleAssessmentValue(v.commitments, c) })
                }
                className="mt-0.5"
              />
              <span className="text-pretty">{ASSESSMENT_LABELS[c]}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Mức độ ưu tiên dự án</Label>
          <RadioGroup
            value={v.project_priority}
            onValueChange={(val) => onChange({ project_priority: val })}
            className="flex gap-4"
          >
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
    </div>
  )
}
