"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail } from "lucide-react"
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
import { updateStaffNotificationEmail } from "@/app/admin/users/actions"

interface Props {
  userId: string
  currentEmail: string | null
  /** Username accounts can have a blank mailbox. Legacy email logins cannot. */
  hasUsername: boolean
  targetLabel: string
  locale: "vi" | "en"
  onSaved: (email: string | null) => void
}

const TEXT = {
  en: {
    add: "Add email",
    edit: "Edit",
    title: "Notification email",
    staffDesc:
      "System notifications for {name} go to this address. They still sign in with their username.",
    loginDesc:
      "This address is also how {name} signs in. Changing it changes their login — tell them before you save.",
    label: "Email address",
    placeholder: "colleague@company.com",
    clearHint: "Leave blank to stop email notifications for this account.",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    saved: "Notification email updated",
    invalid: "Enter a valid email, or leave it blank.",
    invalidRequired: "Enter a valid email address.",
    taken: "This email is already used by another account.",
    forbidden: "You don't have permission to change this.",
    failed: "Could not update the email",
  },
  vi: {
    add: "Thêm email",
    edit: "Sửa",
    title: "Email nhận thông báo",
    staffDesc:
      "Thông báo hệ thống của {name} sẽ gửi về địa chỉ này. Họ vẫn đăng nhập bằng tên đăng nhập.",
    loginDesc:
      "Địa chỉ này cũng là email đăng nhập của {name}. Đổi ở đây là đổi luôn cách họ đăng nhập — báo họ trước khi lưu.",
    label: "Địa chỉ email",
    placeholder: "dongnghiep@congty.com",
    clearHint: "Để trống nếu muốn ngừng gửi email thông báo cho tài khoản này.",
    cancel: "Hủy",
    save: "Lưu",
    saving: "Đang lưu...",
    saved: "Đã cập nhật email nhận thông báo",
    invalid: "Email chưa hợp lệ, hoặc để trống.",
    invalidRequired: "Email chưa hợp lệ.",
    taken: "Email này đã được dùng cho tài khoản khác.",
    forbidden: "Bạn không có quyền sửa email này.",
    failed: "Không cập nhật được email",
  },
}

export function EditNotificationEmailDialog({
  userId,
  currentEmail,
  hasUsername,
  targetLabel,
  locale,
  onSaved,
}: Props) {
  const t = TEXT[locale]
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(currentEmail ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setEmail(currentEmail ?? "")
    setError(null)
  }

  const submit = () => {
    const next = email.trim()
    if (!next && !hasUsername) {
      setError(t.invalidRequired)
      return
    }
    if (next && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setError(hasUsername ? t.invalid : t.invalidRequired)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateStaffNotificationEmail(userId, next)
      if (res.ok) {
        toast.success(t.saved)
        onSaved(next ? next.toLowerCase() : null)
        setOpen(false)
        router.refresh()
        return
      }
      if (res.error === "emailTaken" || res.error === "email_exists") setError(t.taken)
      else if (res.error === "invalidEmail" || res.error === "invalid_contact_email") {
        setError(hasUsername ? t.invalid : t.invalidRequired)
      } else if (res.error === "forbidden" || res.error === "super_admin_only" || res.error === "unauthenticated") {
        setError(t.forbidden)
      } else {
        setError(`${t.failed}${res.error ? ` (${res.error})` : ""}`)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
          <Mail className="mr-1 h-3.5 w-3.5" />
          {currentEmail ? t.edit : t.add}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {(hasUsername ? t.staffDesc : t.loginDesc).replace("{name}", targetLabel)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor={`notify-email-${userId}`}>{t.label}</Label>
          <Input
            id={`notify-email-${userId}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.placeholder}
            autoComplete="off"
          />
          {hasUsername && <p className="text-xs text-muted-foreground">{t.clearHint}</p>}
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t.cancel}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.saving}
              </>
            ) : (
              t.save
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
