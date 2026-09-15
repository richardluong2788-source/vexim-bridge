"use client"

import { useState, useTransition } from "react"
import { KeyRound, Loader2, Eye, EyeOff, RefreshCw } from "lucide-react"
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
import { resetStaffPassword } from "@/app/admin/users/actions"
import { STAFF_PASSWORD_MIN_LENGTH } from "@/lib/auth/staff-login"

interface Props {
  userId: string
  /** Display label of the target (full name or username/email). */
  targetLabel: string
  locale: "vi" | "en"
  /** True when caller is allowed but target is admin/super_admin etc. —
   *  gating itself is enforced server-side; this is purely cosmetic. */
  triggerVariant?: "ghost" | "outline"
}

const TEXT = {
  en: {
    trigger: "Reset password",
    title: "Reset password",
    description:
      "Set a new password for {name}. Give it to them through a secure channel. They can keep using it immediately.",
    newPassword: "New password",
    placeholder: `At least ${STAFF_PASSWORD_MIN_LENGTH} characters`,
    confirm: "Confirm new password",
    generate: "Generate",
    cancel: "Cancel",
    submit: "Save new password",
    saving: "Saving...",
    success: "Password updated",
    weak: `Password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters.`,
    mismatch: "The two passwords do not match.",
    failed: "Could not reset password",
  },
  vi: {
    trigger: "Đặt lại mật khẩu",
    title: "Đặt lại mật khẩu",
    description:
      "Đặt mật khẩu mới cho {name}. Bàn giao mật khẩu mới qua kênh bảo mật; nhân viên dùng được ngay.",
    newPassword: "Mật khẩu mới",
    placeholder: `Tối thiểu ${STAFF_PASSWORD_MIN_LENGTH} ký tự`,
    confirm: "Xác nhận mật khẩu mới",
    generate: "Tạo ngẫu nhiên",
    cancel: "Hủy",
    submit: "Lưu mật khẩu mới",
    saving: "Đang lưu...",
    success: "Đã cập nhật mật khẩu",
    weak: `Mật khẩu phải có ít nhất ${STAFF_PASSWORD_MIN_LENGTH} ký tự.`,
    mismatch: "Hai ô mật khẩu chưa khớp.",
    failed: "Không đặt lại được mật khẩu",
  },
}

function generateRandomPassword(): string {
  const letters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
  const digits = "23456789"
  const all = letters + digits
  const pick = (alphabet: string) =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  let out = pick(letters) + pick(digits)
  for (let i = 0; i < 10; i++) out += pick(all)
  return out
}

export function ResetStaffPasswordDialog({ userId, targetLabel, locale, triggerVariant = "ghost" }: Props) {
  const t = TEXT[locale]
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPassword("")
    setConfirm("")
    setShow(false)
    setError(null)
  }

  const submit = () => {
    if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
      setError(t.weak)
      return
    }
    if (password !== confirm) {
      setError(t.mismatch)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await resetStaffPassword(userId, password)
      if (res.ok) {
        toast.success(t.success)
        setOpen(false)
        reset()
      } else {
        setError(res.error === "weak_password" ? t.weak : `${t.failed} (${res.error ?? "?"})`)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        {triggerVariant === "ghost" ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
            <KeyRound className="mr-1 h-3.5 w-3.5" />
            {t.trigger}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
            <KeyRound className="mr-1 h-3.5 w-3.5" />
            {t.trigger}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {t.description.replace("{name}", targetLabel)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`reset-pw-${userId}`}>{t.newPassword}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id={`reset-pw-${userId}`}
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.placeholder}
                  autoComplete="new-password"
                  className="pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="toggle password"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  setConfirm(next)
                  setShow(true)
                }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t.generate}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`reset-pw-confirm-${userId}`}>{t.confirm}</Label>
            <Input
              id={`reset-pw-confirm-${userId}`}
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t.placeholder}
              autoComplete="new-password"
              className="font-mono"
            />
          </div>
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
              t.submit
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
