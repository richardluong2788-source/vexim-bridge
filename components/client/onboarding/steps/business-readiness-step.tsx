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
  RESPONSE_TIME_OPTIONS,
  MOQ_FLEXIBILITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  LEAD_TIME_OPTIONS,
} from "@/lib/types/readiness"

interface BusinessReadinessStepProps {
  data: AssessmentAnswers["businessReadiness"]
  onChange: (data: AssessmentAnswers["businessReadiness"]) => void
  language: "vi" | "en"
}

export function BusinessReadinessStep({
  data,
  onChange,
  language,
}: BusinessReadinessStepProps) {
  const isVi = language === "vi"

  const current = data ?? {
    hasEnglishSpeaker: false,
    responseTimeHours: "12_to_24_hours",
    moqFlexibility: "standard",
    paymentTermsAccepted: [],
    leadTimeWeeks: "4_to_8_weeks",
    canProvideSamples: false,
    sampleLeadTimeDays: 14,
  }

  function handleChange<K extends keyof NonNullable<AssessmentAnswers["businessReadiness"]>>(
    field: K,
    value: NonNullable<AssessmentAnswers["businessReadiness"]>[K]
  ) {
    onChange({
      ...current,
      [field]: value,
    })
  }

  function handlePaymentTermToggle(term: string) {
    const terms = current.paymentTermsAccepted || []
    const newTerms = terms.includes(term)
      ? terms.filter((t) => t !== term)
      : [...terms, term]
    handleChange("paymentTermsAccepted", newTerms)
  }

  return (
    <div className="space-y-6">
      {/* English Communication */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {isVi ? "Khả năng tiếng Anh" : "English Communication"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isVi
                ? "Có nhân viên có thể giao tiếp tiếng Anh với buyer không?"
                : "Do you have staff who can communicate in English with buyers?"}
            </p>
          </div>
          <Switch
            checked={current.hasEnglishSpeaker}
            onCheckedChange={(checked) => handleChange("hasEnglishSpeaker", checked)}
          />
        </div>
      </div>

      {/* Response Time */}
      <div className="space-y-2">
        <Label>
          {isVi ? "Thời gian phản hồi email/tin nhắn" : "Email/Message Response Time"}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          {isVi
            ? "Thông thường bạn mất bao lâu để phản hồi yêu cầu của buyer?"
            : "How long does it typically take you to respond to buyer inquiries?"}
        </p>
        <Select
          value={current.responseTimeHours}
          onValueChange={(v) =>
            handleChange("responseTimeHours", v as typeof current.responseTimeHours)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESPONSE_TIME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {isVi ? option.labelVi : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* MOQ Flexibility */}
      <div className="space-y-2">
        <Label>
          {isVi ? "Độ linh hoạt MOQ" : "MOQ Flexibility"}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          {isVi
            ? "Bạn có thể linh hoạt về số lượng đặt hàng tối thiểu không?"
            : "How flexible are you with minimum order quantities?"}
        </p>
        <Select
          value={current.moqFlexibility}
          onValueChange={(v) =>
            handleChange("moqFlexibility", v as typeof current.moqFlexibility)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOQ_FLEXIBILITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {isVi ? option.labelVi : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payment Terms */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label className="text-base font-medium">
            {isVi ? "Điều khoản thanh toán chấp nhận" : "Accepted Payment Terms"}
          </Label>
          <p className="text-sm text-muted-foreground">
            {isVi
              ? "Chọn tất cả điều khoản thanh toán mà bạn có thể chấp nhận"
              : "Select all payment terms you can accept"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PAYMENT_TERMS_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`payment-${option.value}`}
                checked={current.paymentTermsAccepted?.includes(option.value) ?? false}
                onCheckedChange={() => handlePaymentTermToggle(option.value)}
              />
              <label
                htmlFor={`payment-${option.value}`}
                className="text-sm cursor-pointer"
              >
                {isVi ? option.labelVi : option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Time */}
      <div className="space-y-2">
        <Label>
          {isVi ? "Thời gian giao hàng" : "Production Lead Time"}
          <span className="text-destructive ml-1">*</span>
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          {isVi
            ? "Thời gian từ khi nhận đơn đến khi hàng sẵn sàng xuất"
            : "Time from order confirmation to goods ready for shipment"}
        </p>
        <Select
          value={current.leadTimeWeeks}
          onValueChange={(v) =>
            handleChange("leadTimeWeeks", v as typeof current.leadTimeWeeks)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_TIME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {isVi ? option.labelVi : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sample Provision */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">
              {isVi ? "Cung cấp mẫu" : "Sample Provision"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isVi
                ? "Bạn có thể gửi mẫu cho buyer tiềm năng không?"
                : "Can you send samples to potential buyers?"}
            </p>
          </div>
          <Switch
            checked={current.canProvideSamples}
            onCheckedChange={(checked) => handleChange("canProvideSamples", checked)}
          />
        </div>

        {current.canProvideSamples && (
          <div className="pt-2 pl-4 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label htmlFor="sampleLeadTime">
                {isVi ? "Thời gian chuẩn bị mẫu (ngày)" : "Sample Lead Time (days)"}
              </Label>
              <Input
                id="sampleLeadTime"
                type="number"
                min={1}
                placeholder="14"
                value={current.sampleLeadTimeDays || ""}
                onChange={(e) =>
                  handleChange("sampleLeadTimeDays", parseInt(e.target.value) || undefined)
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
