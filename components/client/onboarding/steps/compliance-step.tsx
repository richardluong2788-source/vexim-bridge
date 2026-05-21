"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import type { AssessmentAnswers } from "@/lib/types/readiness"

interface ComplianceStepProps {
  data: AssessmentAnswers["compliance"]
  onChange: (data: AssessmentAnswers["compliance"]) => void
  language: "vi" | "en"
}

export function ComplianceStep({
  data,
  onChange,
  language,
}: ComplianceStepProps) {
  const isVi = language === "vi"

  const current = data ?? {
    hasFDA: false,
    fdaNumber: "",
    fdaExpiryDate: "",
    hasHACCP: false,
    hasISO22000: false,
    hasOrganic: false,
    organicCertBody: "",
    hasFactoryVideo: false,
    hasFactoryPhotos: false,
    hasCOA: false,
    coaLabName: "",
  }

  function handleChange<K extends keyof NonNullable<AssessmentAnswers["compliance"]>>(
    field: K,
    value: NonNullable<AssessmentAnswers["compliance"]>[K]
  ) {
    onChange({
      ...current,
      [field]: value,
    })
  }

  return (
    <div className="space-y-6">
      {/* FDA Registration */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {isVi ? "Đăng ký FDA" : "FDA Registration"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isVi
                ? "Bắt buộc để xuất khẩu thực phẩm sang Mỹ"
                : "Required for exporting food products to the US"}
            </p>
          </div>
          <Switch
            checked={current.hasFDA}
            onCheckedChange={(checked) => handleChange("hasFDA", checked)}
          />
        </div>

        {current.hasFDA && (
          <div className="grid gap-4 pt-2 pl-4 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label htmlFor="fdaNumber">
                {isVi ? "Số đăng ký FDA" : "FDA Registration Number"}
              </Label>
              <Input
                id="fdaNumber"
                placeholder="e.g., 12345678901"
                value={current.fdaNumber ?? ""}
                onChange={(e) => handleChange("fdaNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fdaExpiry">
                {isVi ? "Ngày hết hạn" : "Expiry Date"}
              </Label>
              <Input
                id="fdaExpiry"
                type="date"
                value={current.fdaExpiryDate ?? ""}
                onChange={(e) => handleChange("fdaExpiryDate", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Food Safety Certifications */}
      <div className="space-y-4 rounded-lg border p-4">
        <Label className="text-base font-medium">
          {isVi ? "Chứng chỉ an toàn thực phẩm" : "Food Safety Certifications"}
        </Label>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasHACCP"
                checked={current.hasHACCP}
                onCheckedChange={(checked) =>
                  handleChange("hasHACCP", checked === true)
                }
              />
              <label htmlFor="hasHACCP" className="text-sm font-medium cursor-pointer">
                HACCP
              </label>
            </div>
            <span className="text-xs text-muted-foreground">
              {isVi ? "Phân tích mối nguy" : "Hazard Analysis"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasISO22000"
                checked={current.hasISO22000}
                onCheckedChange={(checked) =>
                  handleChange("hasISO22000", checked === true)
                }
              />
              <label htmlFor="hasISO22000" className="text-sm font-medium cursor-pointer">
                ISO 22000
              </label>
            </div>
            <span className="text-xs text-muted-foreground">
              {isVi ? "Quản lý ATTP" : "Food Safety Management"}
            </span>
          </div>
        </div>
      </div>

      {/* Organic Certification */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {isVi ? "Chứng nhận Hữu cơ (Organic)" : "Organic Certification"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isVi
                ? "USDA Organic, EU Organic, hoặc tương đương"
                : "USDA Organic, EU Organic, or equivalent"}
            </p>
          </div>
          <Switch
            checked={current.hasOrganic}
            onCheckedChange={(checked) => handleChange("hasOrganic", checked)}
          />
        </div>

        {current.hasOrganic && (
          <div className="pt-2 pl-4 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label htmlFor="organicCertBody">
                {isVi ? "Tổ chức chứng nhận" : "Certifying Body"}
              </Label>
              <Input
                id="organicCertBody"
                placeholder={isVi ? "VD: Control Union, ECOCERT" : "e.g., Control Union, ECOCERT"}
                value={current.organicCertBody ?? ""}
                onChange={(e) => handleChange("organicCertBody", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Factory Documentation */}
      <div className="space-y-4 rounded-lg border p-4">
        <Label className="text-base font-medium">
          {isVi ? "Tài liệu nhà máy" : "Factory Documentation"}
        </Label>
        <p className="text-sm text-muted-foreground">
          {isVi
            ? "Tài liệu giúp buyer tin tưởng năng lực sản xuất của bạn"
            : "Documentation that helps buyers trust your production capabilities"}
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasFactoryVideo"
              checked={current.hasFactoryVideo}
              onCheckedChange={(checked) =>
                handleChange("hasFactoryVideo", checked === true)
              }
            />
            <label htmlFor="hasFactoryVideo" className="text-sm font-medium cursor-pointer">
              {isVi ? "Có video tham quan nhà máy" : "Has factory tour video"}
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasFactoryPhotos"
              checked={current.hasFactoryPhotos}
              onCheckedChange={(checked) =>
                handleChange("hasFactoryPhotos", checked === true)
              }
            />
            <label htmlFor="hasFactoryPhotos" className="text-sm font-medium cursor-pointer">
              {isVi ? "Có ảnh nhà máy chuyên nghiệp" : "Has professional factory photos"}
            </label>
          </div>
        </div>
      </div>

      {/* COA */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {isVi ? "Giấy phân tích chất lượng (COA)" : "Certificate of Analysis (COA)"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isVi
                ? "Kết quả kiểm nghiệm sản phẩm từ phòng lab"
                : "Product test results from a laboratory"}
            </p>
          </div>
          <Switch
            checked={current.hasCOA}
            onCheckedChange={(checked) => handleChange("hasCOA", checked)}
          />
        </div>

        {current.hasCOA && (
          <div className="pt-2 pl-4 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label htmlFor="coaLabName">
                {isVi ? "Tên phòng thí nghiệm" : "Laboratory Name"}
              </Label>
              <Input
                id="coaLabName"
                placeholder={isVi ? "VD: Quatest 3, SGS" : "e.g., Quatest 3, SGS"}
                value={current.coaLabName ?? ""}
                onChange={(e) => handleChange("coaLabName", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
