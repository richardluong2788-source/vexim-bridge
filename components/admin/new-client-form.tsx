"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, Star, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

import {
  INDUSTRIES,
  INDUSTRY_LABELS_VI,
  type Industry,
} from "@/lib/constants/industries"
import { createClientAccount } from "@/app/admin/clients/new/actions"

type Locale = "vi" | "en"

interface NewClientFormProps {
  locale: Locale
}

export function NewClientForm({ locale }: NewClientFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    email: string
    company: string
  } | null>(null)

  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  // Ordered list; industries[0] is the primary industry used by AI.
  const [selectedIndustries, setSelectedIndustries] = useState<Industry[]>([])
  const [phone, setPhone] = useState("")
  const [fdaNumber, setFdaNumber] = useState("")
  const [fdaExpiresAt, setFdaExpiresAt] = useState("")

  const tr = (vi: string, en: string) => (locale === "vi" ? vi : en)

  function translateError(code: string): string {
    switch (code) {
      case "invalid_email":
        return tr("Email không hợp lệ", "Invalid email address")
      case "full_name_required":
        return tr("Vui lòng nhập họ tên liên hệ", "Contact full name is required")
      case "company_required":
        return tr("Vui lòng nhập tên doanh nghiệp", "Company name is required")
      case "industry_invalid":
        return tr(
          "Vui lòng chọn ít nhất một ngành nghề",
          "Please select at least one industry",
        )
      case "email_exists":
        return tr(
          "Email này đã được đăng ký. Hãy chỉnh sửa hồ sơ khách hàng hiện có thay vì tạo mới.",
          "This email is already registered. Edit the existing client instead.",
        )
      case "forbidden":
        return tr(
          "Bạn không có quyền tạo khách hàng mới.",
          "You are not allowed to create new clients.",
        )
      case "fda_expires_at_invalid":
        return tr("Ngày hết hạn FDA không hợp lệ", "FDA expiry date is invalid")
      default:
        return code
    }
  }

  function toggleIndustry(ind: Industry) {
    setSelectedIndustries((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind],
    )
  }

  function promoteToPrimary(ind: Industry) {
    setSelectedIndustries((prev) => {
      const rest = prev.filter((i) => i !== ind)
      return [ind, ...rest]
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (selectedIndustries.length === 0) {
      setError(translateError("industry_invalid"))
      return
    }

    startTransition(async () => {
      const result = await createClientAccount({
        email,
        full_name: fullName,
        company_name: companyName,
        industries: selectedIndustries,
        phone: phone || null,
        fda_registration_number: fdaNumber || null,
        fda_expires_at: fdaExpiresAt || null,
      })

      if (!result.ok) {
        setError(translateError(result.error ?? "unknown"))
        return
      }

      setSuccess({ email, company: companyName })
      // Reset the form so the admin can add another
      setEmail("")
      setFullName("")
      setCompanyName("")
      setSelectedIndustries([])
      setPhone("")
      setFdaNumber("")
      setFdaExpiresAt("")
      router.refresh()
    })
  }

  const primary = selectedIndustries[0]

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {tr("Tạo tài khoản khách hàng", "Create Client Account")}
        </CardTitle>
        <CardDescription>
          {tr(
            "Khách hàng sẽ nhận email chứa magic-link để đăng nhập. Hãy chọn tất cả các ngành khách hàng đang hoạt động để AI cá nhân hóa email chào hàng chính xác hơn.",
            "The client will receive a magic-link sign-in email. Select every industry the client operates in so AI can personalize outreach accurately.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">
              {tr("Email đăng nhập", "Login Email")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@company.com"
              autoComplete="off"
            />
          </div>

          {/* Contact name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">
              {tr("Người liên hệ", "Contact Name")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={tr("Nguyễn Văn A", "John Smith")}
            />
          </div>

          {/* Company */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="company">
              {tr("Tên doanh nghiệp", "Company Name")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={tr(
                "Công ty TNHH Xuất khẩu ABC",
                "ABC Export Co., Ltd.",
              )}
            />
          </div>

          {/* Industries — multi-select pill grid */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 block text-sm font-medium">
              {tr("Ngành nghề", "Industries")}{" "}
              <span className="text-destructive">*</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({tr("chọn một hoặc nhiều", "select one or more")})
              </span>
            </legend>

            <div
              role="group"
              aria-label={tr("Danh sách ngành nghề", "Industries list")}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {INDUSTRIES.map((ind) => {
                const checked = selectedIndustries.includes(ind)
                const isPrimary = primary === ind
                return (
                  <button
                    key={ind}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleIndustry(ind)}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      checked
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background",
                      )}
                      aria-hidden="true"
                    >
                      {checked && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 leading-tight">
                      <span className="font-medium text-foreground">{ind}</span>
                      {locale === "vi" && (
                        <span className="text-xs text-muted-foreground">
                          {INDUSTRY_LABELS_VI[ind]}
                        </span>
                      )}
                    </span>
                    {isPrimary && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Star className="h-2.5 w-2.5 fill-primary" />
                        {tr("Ngành chính", "Primary")}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Ordered list showing selection + reorder / remove */}
            {selectedIndustries.length > 0 && (
              <div className="mt-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {tr("Đã chọn", "Selected")} ({selectedIndustries.length})
                  {selectedIndustries.length > 1 && (
                    <span className="ml-2 font-normal">
                      ·{" "}
                      {tr(
                        "Nhấn ngôi sao để đặt làm ngành chính cho AI",
                        "Click the star to set a primary industry for AI",
                      )}
                    </span>
                  )}
                </p>
                <ol className="flex flex-wrap gap-2">
                  {selectedIndustries.map((ind, idx) => {
                    const isPrimary = idx === 0
                    return (
                      <li
                        key={ind}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                          isPrimary
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground",
                        )}
                      >
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => promoteToPrimary(ind)}
                            className="text-muted-foreground transition-colors hover:text-primary"
                            aria-label={tr(
                              `Đặt ${ind} làm ngành chính`,
                              `Set ${ind} as primary industry`,
                            )}
                          >
                            <Star className="h-3 w-3" />
                          </button>
                        )}
                        {isPrimary && (
                          <Star
                            className="h-3 w-3 fill-primary text-primary"
                            aria-label={tr("Ngành chính", "Primary")}
                          />
                        )}
                        <span>{ind}</span>
                        <button
                          type="button"
                          onClick={() => toggleIndustry(ind)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={tr(
                            `Bỏ chọn ${ind}`,
                            `Remove ${ind}`,
                          )}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {tr(
                "AI sẽ ưu tiên sử dụng ngành chính (ngôi sao) để soạn email chào hàng. Các ngành còn lại được dùng để gợi ý cross-selling và filter buyer phù hợp.",
                "AI uses the primary industry (starred) to draft outreach emails. Additional industries power cross-selling and buyer matching.",
              )}
            </p>
          </fieldset>

          {/* Phone (optional) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">
              {tr("Số điện thoại", "Phone")}{" "}
              <span className="text-xs text-muted-foreground">
                ({tr("tùy chọn", "optional")})
              </span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+84 90 123 4567"
            />
          </div>

          {/* FDA section */}
          <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-sm font-medium">
                {tr(
                  "Thông tin FDA (tùy chọn — có thể bổ sung sau)",
                  "FDA Registration (optional — can be added later)",
                )}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr(
                  "Cần thiết trước khi gán Buyer và đẩy cơ hội qua giai đoạn Sample. Nếu chưa có, bạn có thể bổ sung trong hồ sơ khách hàng.",
                  "Required before assigning buyers and advancing past Sample. Can be added later from the client profile.",
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fdaNumber" className="text-xs">
                {tr("Số đăng ký FDA", "FDA Registration Number")}
              </Label>
              <Input
                id="fdaNumber"
                value={fdaNumber}
                onChange={(e) => setFdaNumber(e.target.value)}
                placeholder="12345678901"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fdaExpires" className="text-xs">
                {tr("Ngày hết hạn", "Expiry Date")}
              </Label>
              <Input
                id="fdaExpires"
                type="date"
                value={fdaExpiresAt}
                onChange={(e) => setFdaExpiresAt(e.target.value)}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="text-pretty">{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {tr("Đã tạo khách hàng", "Client created")}:{" "}
                  {success.company}
                </span>
                <span className="text-xs opacity-80">
                  {tr(
                    `Email magic-link đã được gửi tới ${success.email}. Khách hàng có thể đăng nhập ngay.`,
                    `Magic-link email sent to ${success.email}. They can sign in immediately.`,
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/clients")}
              disabled={isPending}
            >
              {tr("Quay lại", "Back")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Tạo tài khoản", "Create Account")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
