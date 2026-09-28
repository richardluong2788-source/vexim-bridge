"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { upload } from "@vercel/blob/client"
import { toast } from "sonner"
import { Camera, Copy, Eye, EyeOff, Loader2, Lock, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  changeMyPassword,
  updateMyEmail,
  updateMyProfile,
  type ProfileErrorCode,
} from "@/app/settings/profile/actions"

const AVATAR_MAX_BYTES = 5 * 1024 * 1024
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp"

export interface MyProfileInitial {
  userId: string
  fullName: string
  email: string
  avatarUrl: string | null
  username: string | null
  workEmail: string | null
  companyName: string | null
  roleLabel: string
  /** Username login: email is only the notification mailbox, not the password key. */
  isStaffLogin: boolean
}

interface Props {
  initial: MyProfileInitial
}

function errorText(
  code: ProfileErrorCode | string | undefined,
  p: {
    errFullNameRequired: string
    errInvalidEmail: string
    errEmailTaken: string
    errWrongPassword: string
    errWeakPassword: string
    avatarFailed: string
    saveError: string
  },
): string {
  switch (code) {
    case "fullNameRequired":
      return p.errFullNameRequired
    case "invalidEmail":
      return p.errInvalidEmail
    case "invalidAvatar":
      return p.avatarFailed
    case "emailTaken":
      return p.errEmailTaken
    case "wrongPassword":
      return p.errWrongPassword
    case "weakPassword":
      return p.errWeakPassword
    default:
      return p.saveError
  }
}

export function MyProfileForm({ initial }: Props) {
  const { t } = useTranslation()
  const p = t.settings.profile
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(initial.fullName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl)
  const [uploading, setUploading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profilePending, startProfile] = useTransition()

  const [email, setEmail] = useState(initial.email)
  const [emailPassword, setEmailPassword] = useState("")
  const [showEmailPassword, setShowEmailPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailPending, startEmail] = useTransition()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordPending, startPassword] = useTransition()

  const initialLetter = (fullName || initial.username || initial.email || "?").trim().charAt(0).toUpperCase() || "?"

  async function handleAvatarFile(file: File) {
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
      toast.error(p.avatarFailed)
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(p.avatarTooLarge)
      return
    }

    setUploading(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const blob = await upload(`avatars/${initial.userId}/${Date.now()}_${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/profile/upload-media",
      })
      setAvatarUrl(blob.url)
    } catch (err) {
      console.error("[v0] avatar upload failed:", err)
      toast.error(p.avatarFailed)
    } finally {
      setUploading(false)
    }
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError(null)
    startProfile(async () => {
      const res = await updateMyProfile({ fullName, avatarUrl })
      if (res.ok) {
        toast.success(p.savedProfile)
        router.refresh()
      } else {
        setProfileError(errorText(res.error, p))
      }
    })
  }

  function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    if (!initial.isStaffLogin && !email.trim()) {
      setEmailError(p.errInvalidEmail)
      return
    }
    startEmail(async () => {
      const res = await updateMyEmail({ email, currentPassword: emailPassword })
      if (res.ok) {
        toast.success(p.savedEmail)
        setEmailPassword("")
        router.refresh()
      } else {
        setEmailError(errorText(res.error, p))
      }
    })
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError(p.errWeakPassword)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(p.errMismatch)
      return
    }
    startPassword(async () => {
      const res = await changeMyPassword({ currentPassword, newPassword })
      if (res.ok) {
        toast.success(p.savedPassword)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setPasswordError(errorText(res.error, p))
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={saveProfile} className="rounded-lg border border-border bg-card p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">{p.sectionBasic}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{p.sectionBasicDesc}</p>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border bg-muted">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
                  {initialLetter}
                </span>
              )}
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (file) void handleAvatarFile(file)
              }}
            />
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="mr-1 h-3.5 w-3.5" />
                {avatarUrl ? p.avatarReplace : p.avatarUpload}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  disabled={uploading}
                  onClick={() => setAvatarUrl(null)}
                >
                  {p.avatarRemove}
                </Button>
              )}
            </div>
            <p className="max-w-40 text-center text-[11px] text-muted-foreground">{p.avatarHint}</p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">{p.fullName}</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={p.fullNamePlaceholder}
                autoComplete="name"
                maxLength={120}
                required
              />
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {initial.username && (
                <div className="flex flex-col gap-1">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    {p.username}
                  </dt>
                  <dd className="font-mono text-foreground">@{initial.username}</dd>
                  <dd className="text-[11px] text-muted-foreground">{p.usernameHint}</dd>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{p.role}</dt>
                <dd className="text-foreground">{initial.roleLabel}</dd>
              </div>
              {initial.companyName && (
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">{p.company}</dt>
                  <dd className="truncate text-foreground">{initial.companyName}</dd>
                </div>
              )}
              {initial.workEmail && (
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{p.workEmail}</dt>
                  <dd className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-foreground">{initial.workEmail}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => {
                        navigator.clipboard.writeText(initial.workEmail!)
                        toast.success(p.copied)
                      }}
                      aria-label={p.workEmail}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </dd>
                  <dd className="text-[11px] text-muted-foreground">{p.workEmailHint}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {profileError && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {profileError}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={profilePending || uploading}>
            {profilePending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {profilePending ? p.saving : p.save}
          </Button>
        </div>
      </form>

      <form onSubmit={saveEmail} className="rounded-lg border border-border bg-card p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">{p.sectionEmail}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {initial.isStaffLogin ? p.sectionEmailStaffDesc : p.sectionEmailClientDesc}
          </p>
        </div>

        {!email.trim() && (
          <p className="mb-4 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {p.emailMissing}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-email">{p.email}</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={p.emailPlaceholder}
              autoComplete="email"
              required={!initial.isStaffLogin}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-email-password">{p.currentPassword}</Label>
            <div className="relative">
              <Input
                id="profile-email-password"
                type={showEmailPassword ? "text" : "password"}
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowEmailPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={p.currentPassword}
              >
                {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{p.currentPasswordHint}</p>
          </div>
        </div>

        {emailError && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {emailError}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={emailPending}>
            {emailPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {emailPending ? p.saving : p.save}
          </Button>
        </div>
      </form>

      <form onSubmit={savePassword} className="rounded-lg border border-border bg-card p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">{p.sectionPassword}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{p.sectionPasswordDesc}</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-current-password">{p.currentPassword}</Label>
            <Input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-new-password">{p.newPassword}</Label>
            <div className="relative">
              <Input
                id="profile-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-9"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={p.newPassword}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-confirm-password">{p.confirmPassword}</Label>
            <Input
              id="profile-confirm-password"
              type={showNewPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
        </div>

        {passwordError && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {passwordError}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={passwordPending}>
            {passwordPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {passwordPending ? p.saving : p.save}
          </Button>
        </div>
      </form>
    </div>
  )
}
