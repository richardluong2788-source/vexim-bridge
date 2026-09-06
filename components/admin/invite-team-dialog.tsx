"use client"

import { useState, useTransition } from "react"
import { UserPlus, Loader2, Mail, User, Shield, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { inviteTeamMember } from "@/app/admin/users/actions"
import { AeIndustryPicker } from "@/components/admin/ae-industry-picker"
import type { Role } from "@/lib/supabase/types"

interface Props {
  locale: "vi" | "en"
  currentUserRole: Role
}

const INTERNAL_ROLES: { value: Role; labelEn: string; labelVi: string; description: string }[] = [
  {
    value: "account_executive",
    labelEn: "Account Executive",
    labelVi: "Account Executive",
    description: "Manages client relationships and opportunities",
  },
  {
    value: "lead_researcher",
    labelEn: "Lead Researcher",
    labelVi: "Lead Researcher",
    description: "Researches and imports buyer leads",
  },
  {
    value: "supplier_researcher",
    labelEn: "Supplier Researcher",
    labelVi: "Supplier Researcher",
    description: "Sources and qualifies suppliers into the pool",
  },
  {
    value: "finance",
    labelEn: "Finance",
    labelVi: "Finance",
    description: "Handles invoicing and financial operations",
  },
  {
    value: "admin",
    labelEn: "Admin",
    labelVi: "Admin",
    description: "Full system access (super_admin only)",
  },
]

const MESSAGES = {
  en: {
    title: "Invite Team Member",
    description: "Send an invitation email to add a new internal team member.",
    email: "Email Address",
    emailPlaceholder: "colleague@company.com",
    fullName: "Full Name",
    fullNamePlaceholder: "John Doe",
    role: "Role",
    rolePlaceholder: "Select a role",
    industry: "Industries",
    industryHint:
      "AI matching only routes buyers to AEs covering the buyer's industry — required for Account Executives. Select multiple if needed; the starred one is primary.",
    industryHintSr:
      "Optional — the sourcing board will prioritize these industries for this researcher. Leave empty to cover all industries.",
    cancel: "Cancel",
    invite: "Send Invitation",
    inviting: "Sending...",
    success: "Invitation sent successfully!",
    workEmailLabel: "Personal sender address (Resend):",
    workEmailHint:
      "This person's buyer-facing emails will be sent and received from this address via Resend automatically — nothing to set up, no mailbox to create.",
    errors: {
      invalid_email: "Please enter a valid email address",
      full_name_required: "Full name is required",
      invalid_role: "Please select a valid role",
      invalid_industry: "Please select at least one industry for this Account Executive",
      email_exists: "This email is already registered",
      super_admin_only: "Only Super Admin can invite Admin users",
      forbidden: "You don't have permission to invite users",
      default: "Failed to send invitation. Please try again.",
    },
  },
  vi: {
    title: "Mời thành viên mới",
    description: "Gửi email mời để thêm thành viên nội bộ mới vào hệ thống.",
    email: "Địa chỉ Email",
    emailPlaceholder: "dongnghiep@congty.com",
    fullName: "Họ và tên",
    fullNamePlaceholder: "Nguyen Van A",
    role: "Vai trò",
    rolePlaceholder: "Chọn vai trò",
    industry: "Ngành hàng",
    industryHint:
      "AI chỉ đưa buyer vào inbox của AE phụ trách ngành hàng của buyer — bắt buộc đối với Account Executive. Chọn được nhiều ngành; ngành có dấu sao là ngành chính.",
    industryHintSr:
      "Tùy chọn — bảng Nhu cầu & Nguồn cung sẽ mặc định lọc theo các ngành này cho SR. Bỏ trống nếu SR phụ trách tất cả các ngành.",
    cancel: "Hủy",
    invite: "Gửi lời mời",
    inviting: "Đang gửi...",
    success: "Gửi lời mời thành công!",
    workEmailLabel: "Địa chỉ gửi riêng (qua Resend):",
    workEmailHint:
      "Email gửi cho buyer của người này sẽ dùng địa chỉ này — gửi và nhận đều tự động qua Resend, không cần thiết lập gì thêm, không cần tạo hộp mail.",
    errors: {
      invalid_email: "Vui lòng nhập địa chỉ email hợp lệ",
      full_name_required: "Họ tên là bắt buộc",
      invalid_role: "Vui lòng chọn vai trò hợp lệ",
      invalid_industry: "Vui lòng chọn ít nhất một ngành hàng cho Account Executive này",
      email_exists: "Email này đã được đăng ký",
      super_admin_only: "Chỉ Super Admin mới có thể mời Admin",
      forbidden: "Bạn không có quyền mời người dùng",
      default: "Gửi lời mời thất bại. Vui lòng thử lại.",
    },
  },
}

export function InviteTeamDialog({ locale, currentUserRole }: Props) {
  const t = MESSAGES[locale]
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<Role | "">("")
  const [industries, setIndustries] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [generatedWorkEmail, setGeneratedWorkEmail] = useState<string | null>(null)

  const isAccountExecutive = role === "account_executive"
  const isSupplierResearcher = role === "supplier_researcher"
  // Industries are REQUIRED for AEs (matching hard-gate) and OPTIONAL for
  // SRs (their sourcing patch on /admin/sourcing — empty = see everything).
  const needsIndustries = isAccountExecutive || isSupplierResearcher

  // Filter roles based on current user's permissions
  const availableRoles = INTERNAL_ROLES.filter((r) => {
    // Only super_admin can invite admin
    if (r.value === "admin" && currentUserRole !== "super_admin") {
      return false
    }
    return true
  })

  const resetForm = () => {
    setEmail("")
    setFullName("")
    setRole("")
    setIndustries([])
    setError(null)
    setSuccess(false)
    setGeneratedWorkEmail(null)
  }

  const handleSubmit = () => {
    if (!role) {
      setError(t.errors.invalid_role)
      return
    }
    if (isAccountExecutive && industries.length === 0) {
      setError(t.errors.invalid_industry)
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await inviteTeamMember({
        email,
        full_name: fullName,
        role: role as Role,
        industries: needsIndustries ? industries : undefined,
      })

      if (result.ok) {
        setSuccess(true)
        setGeneratedWorkEmail(result.workEmail ?? null)
        // Keep the dialog open longer when there's a work email to show —
        // the admin needs time to read/copy it before it auto-closes.
        setTimeout(
          () => {
            setOpen(false)
            resetForm()
          },
          result.workEmail ? 6000 : 1500,
        )
      } else {
        const errorKey = result.error as keyof typeof t.errors
        setError(t.errors[errorKey] || t.errors.default)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          {locale === "vi" ? "Mời thành viên" : "Invite Member"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Email */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {t.email}
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Full Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {t.fullName}
            </Label>
            <Input
              id="invite-name"
              type="text"
              placeholder={t.fullNamePlaceholder}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              {t.role}
            </Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as Role)}
              disabled={isPending}
            >
              <SelectTrigger id="invite-role">
                <SelectValue placeholder={t.rolePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{locale === "vi" ? r.labelVi : r.labelEn}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Industries — required for AE (matching gate), optional for SR */}
          {needsIndustries && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-industry" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                {t.industry}
                {isSupplierResearcher && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({locale === "vi" ? "tùy chọn" : "optional"})
                  </span>
                )}
              </Label>
              <AeIndustryPicker
                id="invite-industry"
                value={industries}
                onChange={setIndustries}
                disabled={isPending}
                locale={locale}
              />
              <p className="text-xs text-muted-foreground">
                {isSupplierResearcher ? t.industryHintSr : t.industryHint}
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Success message */}
          {success && (
            <div className="flex flex-col gap-2" role="status">
              <p className="text-sm text-green-600">{t.success}</p>
              {generatedWorkEmail && (
                <div className="rounded-md border border-border bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t.workEmailLabel}</p>
                  <p className="mt-1 font-mono text-sm font-medium text-foreground">
                    {generatedWorkEmail}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{t.workEmailHint}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || success}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.inviting}
              </>
            ) : (
              t.invite
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
