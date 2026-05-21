"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AssessmentAnswers } from "@/lib/types/readiness"
import {
  YEARS_EXPORTING_OPTIONS,
  ORDER_VALUE_OPTIONS,
  EXPORT_MARKETS_OPTIONS,
  CHALLENGES_OPTIONS,
} from "@/lib/types/readiness"

interface ExportExperienceStepProps {
  data: AssessmentAnswers["exportExperience"]
  onChange: (data: AssessmentAnswers["exportExperience"]) => void
  language: "vi" | "en"
}

export function ExportExperienceStep({
  data,
  onChange,
  language,
}: ExportExperienceStepProps) {
  const isVi = language === "vi"

  const current = data ?? {
    hasExportedBefore: false,
    yearsExporting: "never",
    previousMarkets: [],
    currentBuyers: 0,
    biggestOrderValue: "under_10k",
    hasUsMarketExperience: false,
    mainChallenges: [],
  }

  function handleChange<K extends keyof NonNullable<AssessmentAnswers["exportExperience"]>>(
    field: K,
    value: NonNullable<AssessmentAnswers["exportExperience"]>[K]
  ) {
    onChange({
      ...current,
      [field]: value,
    })
  }

  function handleMarketToggle(market: string) {
    const markets = current.previousMarkets || []
    const newMarkets = markets.includes(market)
      ? markets.filter((m) => m !== market)
      : [...markets, market]
    handleChange("previousMarkets", newMarkets)
  }

  function handleChallengeToggle(challenge: string) {
    const challenges = current.mainChallenges || []
    const newChallenges = challenges.includes(challenge)
      ? challenges.filter((c) => c !== challenge)
      : [...challenges, challenge]
    handleChange("mainChallenges", newChallenges)
  }

  return (
    <div className="space-y-6">
      {/* Has Exported Before */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {isVi ? "Đã từng xuất khẩu" : "Export History"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isVi
                ? "Doanh nghiệp của bạn đã từng xuất khẩu chưa?"
                : "Has your business exported before?"}
            </p>
          </div>
          <Switch
            checked={current.hasExportedBefore}
            onCheckedChange={(checked) => handleChange("hasExportedBefore", checked)}
          />
        </div>

        {current.hasExportedBefore && (
          <div className="space-y-4 pt-2 pl-4 border-l-2 border-primary/20">
            {/* Years Exporting */}
            <div className="space-y-2">
              <Label>
                {isVi ? "Số năm kinh nghiệm xuất khẩu" : "Years of Export Experience"}
              </Label>
              <Select
                value={current.yearsExporting}
                onValueChange={(v) =>
                  handleChange("yearsExporting", v as typeof current.yearsExporting)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS_EXPORTING_OPTIONS.filter((o) => o.value !== "never").map(
                    (option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {isVi ? option.labelVi : option.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Current Buyers */}
            <div className="space-y-2">
              <Label htmlFor="currentBuyers">
                {isVi ? "Số buyer đang làm việc" : "Current Active Buyers"}
              </Label>
              <Input
                id="currentBuyers"
                type="number"
                min={0}
                placeholder="0"
                value={current.currentBuyers || ""}
                onChange={(e) =>
                  handleChange("currentBuyers", parseInt(e.target.value) || 0)
                }
              />
            </div>

            {/* Biggest Order Value */}
            <div className="space-y-2">
              <Label>
                {isVi ? "Giá trị đơn hàng lớn nhất" : "Largest Order Value"}
              </Label>
              <Select
                value={current.biggestOrderValue}
                onValueChange={(v) =>
                  handleChange("biggestOrderValue", v as typeof current.biggestOrderValue)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_VALUE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {isVi ? option.labelVi : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Previous Markets */}
            <div className="space-y-3">
              <Label>
                {isVi ? "Thị trường đã xuất khẩu" : "Markets Exported To"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_MARKETS_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`market-${option.value}`}
                      checked={current.previousMarkets?.includes(option.value) ?? false}
                      onCheckedChange={() => handleMarketToggle(option.value)}
                    />
                    <label
                      htmlFor={`market-${option.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {isVi ? option.labelVi : option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* US Market Experience */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {isVi ? "Kinh nghiệm thị trường Mỹ" : "US Market Experience"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isVi
                ? "Đã từng bán sản phẩm vào thị trường Mỹ chưa?"
                : "Have you sold products to the US market before?"}
            </p>
          </div>
          <Switch
            checked={current.hasUsMarketExperience}
            onCheckedChange={(checked) =>
              handleChange("hasUsMarketExperience", checked)
            }
          />
        </div>
      </div>

      {/* Main Challenges */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label className="text-base font-medium">
            {isVi ? "Thách thức chính" : "Main Challenges"}
          </Label>
          <p className="text-sm text-muted-foreground">
            {isVi
              ? "Chọn các thách thức mà doanh nghiệp bạn đang gặp phải khi xuất khẩu"
              : "Select the challenges your business faces when exporting"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {CHALLENGES_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`challenge-${option.value}`}
                checked={current.mainChallenges?.includes(option.value) ?? false}
                onCheckedChange={() => handleChallengeToggle(option.value)}
              />
              <label
                htmlFor={`challenge-${option.value}`}
                className="text-sm cursor-pointer"
              >
                {isVi ? option.labelVi : option.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
