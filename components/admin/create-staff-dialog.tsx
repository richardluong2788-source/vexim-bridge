"use client"

import { useState, useTransition } from "react"
import {
  UserPlus,
  Loader2,
  User,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  CheckCircle2,
  Mail,
} from "lucide-react"
import { toast } from "sonner"
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
import {
  createStaffAccount,
  type CreateStaffAccountResult,
} from "@/app/admin/users/actions"
import { AeIndustryPicker } from "@/components/admin/ae-industry-picker"
import {
  STAFF_PASSWORD_MIN_LENGTH,
  normalizeUsername,
} from "@/lib/auth/staff-login"
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
    title: "Create staff account",
    description:
      "Create an internal login directly with a username and password. No invitation email is sent — hand the credentials to the person yourself.",
    trigger: "Create staff",
    fullName: "Full name",
    fullNamePlaceholder: "Nguyen Van A",
    username: "Username",
    usernamePlaceholder: "e.g. nguyenvana or ae01",
    usernameHint:
      "3–30 characters: lowercase letters, numbers, dot, hyphen or underscore. Used together with the password to sign in.",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Re-enter the password",
    generate: "Generate",
    contactEmail: "Notification email (optional)",
    contactEmailPlaceholder: "colleague@company.com",
    contactEmailHint:
      "Only used to deliver system notifications. The account always signs in with its username. Leave blank to add it later on their profile or in this table.",
    role: "Role",
    rolePlaceholder: "Select a role",
    industry: "Industries",
    industryHint:
      "AI matching only routes buyers to AEs covering the buyer's industry — required for Account Executives. Select multiple if needed; the starred one is primary.",
    industryHintSr:
      "Optional — the sourcing board will prioritize these industries for this researcher. Leave empty to cover all industries.",
    cancel: "Cancel",
    submit: "Create account",
    submitting: "Creating...",
    createAnother: "Create another",
    successTitle: "Account created",
    successDesc: "Give these credentials to the employee through a secure channel:",
    usernameLabel: "Username",
    passwordLabel: "Password",
    copy: "Copy",
    copied: "Copied",
    copyCredentials: "Copy username + password",
    workEmailLabel: "Personal sender address:",
    errors: {
      invalid_username: "Username must be 3–30 lowercase letters/numbers (dot, hyphen, underscore allowed).",
      weak_password: `Password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters.`,
      password_mismatch: "The two passwords do not match.",
      full_name_required: "Full name is required.",
      invalid_role: "Please select a valid role.",
      invalid_industry: "Please select at least one industry for this Account Executive.",
      invalid_contact_email: "Please enter a valid notification email or leave it blank.",
      username_taken: "This username is already taken.",
      email_exists: "This notification email is already used by another account.",
      super_admin_only: "Only a Super Admin can create Admin accounts.",
      rate_limited: "Too many requests. Please wait a few minutes and try again.",
      forbidden: "You don't have permission to create accounts.",
      default: "Failed to create the account. Please try again.",
    },
  },
  vi: {
    title: "Tạo tài khoản nhân viên",
    description:
      "Tạo trực tiếp tài khoản nội bộ với tên đăng nhập và mật khẩu. Hệ thống không gửi email mời — bạn tự bàn giao thông tin đăng nhập cho nhân viên.",
    trigger: "Tạo nhân viên",
    fullName: "Họ và tên",
    fullNamePlaceholder: "Nguyễn Văn A",
    username: "Tên đăng nhập",
    usernamePlaceholder: "VD: nguyenvana hoặc ae01",
    usernameHint:
      "3–30 ký tự: chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới. Dùng kèm mật khẩu để đăng nhập.",
    password: "Mật khẩu",
    passwordPlaceholder: "Tối thiểu 8 ký tự",
    confirmPassword: "Xác nhận mật khẩu",
    confirmPasswordPlaceholder: "Nhập lại mật khẩu",
    generate: "Tạo ngẫu nhiên",
    contactEmail: "Email nhận thông báo (không bắt buộc)",
    contactEmailPlaceholder: "dongnghiep@congty.com",
    contactEmailHint:
      "Chỉ dùng để gửi thông báo hệ thống. Tài khoản luôn đăng nhập bằng tên đăng nhập. Bỏ trống vẫn tạo được — bổ sung sau ở trang cá nhân hoặc ngay tại bảng này.",
    role: "Vai trò",
    rolePlaceholder: "Chọn vai trò",
    industry: "Ngành hàng",
    industryHint:
      "AI chỉ đưa buyer vào inbox của AE phụ trách ngành hàng của buyer — bắt buộc đối với Account Executive. Chọn được nhiều ngành; ngành có dấu sao là ngành chính.",
    industryHintSr:
      "Tùy chọn — bảng Nhu cầu & Nguồn cung sẽ mặc định lọc theo các ngành này cho SR. Bỏ trống nếu SR phụ trách tất cả các ngành.",
    cancel: "Hủy",
    submit: "Tạo tài khoản",
    submitting: "Đang tạo...",
    createAnother: "Tạo thêm người khác",
    successTitle: "Đã tạo tài khoản",
    successDesc: "Bàn giao thông tin sau cho nhân viên qua kênh bảo mật:",
    usernameLabel: "Tên đăng nhập",
    passwordLabel: "Mật khẩu",
    copy: "Sao chép",
    copied: "Đã chép",
    copyCredentials: "Chép tên đăng nhập + mật khẩu",
    workEmailLabel: "Địa chỉ gửi riêng:",
    errors: {
      invalid_username: "Tên đăng nhập gồm 3–30 ký tự chữ thường/số (được dùng dấu chấm, gạch ngang, gạch dưới).",
      weak_password: `Mật khẩu phải có ít nhất ${STAFF_PASSWORD_MIN_LENGTH} ký tự.`,
      password_mismatch: "Hai ô mật khẩu chưa khớp.",
      full_name_required: "Vui lòng nhập họ tên.",
      invalid_role: "Vui lòng chọn vai trò hợp lệ.",
      invalid_industry: "Vui lòng chọn ít nhất một ngành hàng cho Account Executive này.",
      invalid_contact_email: "Email nhận thông báo chưa hợp lệ, hoặc để trống.",
      username_taken: "Tên đăng nhập này đã được sử dụng.",
      email_exists: "Email này đã gắn với tài khoản khác.",
      super_admin_only: "Chỉ Super Admin mới được tạo tài khoản Admin.",
      rate_limited: "Quá nhiều yêu cầu. Vui lòng đợi vài phút rồi thử lại.",
      forbidden: "Bạn không có quyền tạo tài khoản.",
      default: "Tạo tài khoản thất bại. Vui lòng thử lại.",
    },
  },
}

function generateRandomPassword(): string {
  // 12 chars from an unambiguous alphabet, guaranteed to include a
  // letter and a digit. Runs entirely in the browser.
  const letters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
  const digits = "23456789"
  const all = letters + digits
  const pick = (alphabet: string) =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  let out = pick(letters) + pick(digits)
  for (let i = 0; i < 10; i++) out += pick(all)
  return out
}

export function CreateStaffDialog({ locale, currentUserRole }: Props) {
  const t = MESSAGES[locale]
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [role, setRole] = useState<Role | "">("")
  const [industries, setIndustries] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ username: string; password: string; workEmail: string | null } | null>(null)

  const isAccountExecutive = role === "account_executive"
  const isSupplierResearcher = role === "supplier_researcher"
  const needsIndustries = isAccountExecutive || isSupplierResearcher

  const availableRoles = INTERNAL_ROLES.filter((r) => {
    // Only super_admin can create admin accounts.
    if (r.value === "admin" && currentUserRole !== "super_admin") {
      return false
    }
    return true
  })

  const resetForm = () => {
    setFullName("")
    setUsername("")
    setPassword("")
    setConfirmPassword("")
    setContactEmail("")
    setRole("")
    setIndustries([])
    setShowPassword(false)
    setError(null)
    setCreated(null)
  }

  const handleSubmit = () => {
    if (!fullName.trim()) {
      setError(t.errors.full_name_required)
      return
    }
    const normalized = normalizeUsername(username)
    if (!/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(normalized)) {
      setError(t.errors.invalid_username)
      return
    }
    if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
      setError(t.errors.weak_password)
      return
    }
    if (password !== confirmPassword) {
      setError(t.errors.password_mismatch)
      return
    }
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
      let result: CreateStaffAccountResult
      try {
        result = await createStaffAccount({
          username: normalized,
          password,
          full_name: fullName,
          role: role as Role,
          contact_email: contactEmail.trim() || undefined,
          industries: needsIndustries ? industries : undefined,
        })
      } catch (err) {
        console.error("[CreateStaffDialog] createStaffAccount threw:", err)
        setError(t.errors.default)
        return
      }

      if (result.ok && result.username) {
        setCreated({
          username: result.username,
          password,
          workEmail: result.workEmail ?? null,
        })
      } else {
        const errorKey = result.error as keyof typeof t.errors
        const known = t.errors[errorKey]
        setError(
          known ||
            (result.error
              ? `${t.errors.default} (${result.error})`
              : t.errors.default),
        )
      }
    })
  }

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(locale === "vi" ? `Đã sao chép ${label}` : `${label} copied`)
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
          {t.trigger}
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

        {created ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-start gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{t.successTitle}</p>
                <p className="text-xs opacity-80">{t.successDesc}</p>
              </div>
            </div>

            <CredentialRow
              label={t.usernameLabel}
              value={created.username}
              copyLabel={t.copy}
              onCopy={() => copyText(created.username, t.usernameLabel)}
            />
            <CredentialRow
              label={t.passwordLabel}
              value={created.password}
              copyLabel={t.copy}
              onCopy={() => copyText(created.password, t.passwordLabel)}
              secret
            />

            {created.workEmail && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t.workEmailLabel}{" "}
                <span className="font-mono text-foreground">{created.workEmail}</span>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                copyText(
                  `${t.usernameLabel}: ${created.username}\n${t.passwordLabel}: ${created.password}`,
                  t.copyCredentials,
                )
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              {t.copyCredentials}
            </Button>

            <DialogFooter>
              <Button onClick={resetForm} className="w-full">
                {t.createAnother}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2 pr-1">
              {/* Full name */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-fullname" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {t.fullName}
                </Label>
                <Input
                  id="staff-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  autoComplete="off"
                />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-username" className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  {t.username}
                </Label>
                <Input
                  id="staff-username"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder={t.usernamePlaceholder}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">{t.usernameHint}</p>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-password" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  {t.password}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      autoComplete="new-password"
                      className="pr-9 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const next = generateRandomPassword()
                      setPassword(next)
                      setConfirmPassword(next)
                      setShowPassword(true)
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {t.generate}
                  </Button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-password-confirm">{t.confirmPassword}</Label>
                <Input
                  id="staff-password-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.confirmPasswordPlaceholder}
                  autoComplete="new-password"
                  className="font-mono"
                />
              </div>

              {/* Role */}
              <div className="flex flex-col gap-2">
                <Label>{t.role}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.rolePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="flex flex-col items-start gap-0.5">
                          <span>{locale === "vi" ? r.labelVi : r.labelEn}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {r.description}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Industries (AE/SR only) */}
              {needsIndustries && (
                <div className="flex flex-col gap-2">
                  <Label>{t.industry}</Label>
                  <AeIndustryPicker
                    value={industries}
                    onChange={setIndustries}
                    disabled={isPending}
                    locale={locale}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isAccountExecutive ? t.industryHint : t.industryHintSr}
                  </p>
                </div>
              )}

              {/* Optional notification email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="staff-contact-email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {t.contactEmail}
                </Label>
                <Input
                  id="staff-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={t.contactEmailPlaceholder}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{t.contactEmailHint}</p>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  resetForm()
                }}
              >
                {t.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.submitting}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t.submit}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CredentialRow({
  label,
  value,
  copyLabel,
  onCopy,
  secret,
}: {
  label: string
  value: string
  copyLabel: string
  onCopy: () => void
  secret?: boolean
}) {
  const [shown, setShown] = useState(!secret)
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="truncate font-mono text-sm">{shown ? value : "•".repeat(value.length)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {secret && (
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setShown((v) => !v)}>
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={onCopy}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          <span className="text-xs">{copyLabel}</span>
        </Button>
      </div>
    </div>
  )
}
