"use client"

import { useState, useTransition } from "react"
import { UserPlus, Loader2, Mail, User, Shield } from "lucide-react"
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
    cancel: "Cancel",
    invite: "Send Invitation",
    inviting: "Sending...",
    success: "Invitation sent successfully!",
    errors: {
      invalid_email: "Please enter a valid email address",
      full_name_required: "Full name is required",
      invalid_role: "Please select a valid role",
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
    cancel: "Hủy",
    invite: "Gửi lời mời",
    inviting: "Đang gửi...",
    success: "Gửi lời mời thành công!",
    errors: {
      invalid_email: "Vui lòng nhập địa chỉ email hợp lệ",
      full_name_required: "Họ tên là bắt buộc",
      invalid_role: "Vui lòng chọn vai trò hợp lệ",
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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    setError(null)
    setSuccess(false)
  }

  const handleSubmit = () => {
    if (!role) {
      setError(t.errors.invalid_role)
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await inviteTeamMember({
        email,
        full_name: fullName,
        role: role as Role,
      })

      if (result.ok) {
        setSuccess(true)
        setTimeout(() => {
          setOpen(false)
          resetForm()
        }, 1500)
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

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Success message */}
          {success && (
            <p className="text-sm text-green-600" role="status">
              {t.success}
            </p>
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
