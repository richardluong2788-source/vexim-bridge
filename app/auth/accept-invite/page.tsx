"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
import { AlertCircle, CheckCircle2, Loader2, TrendingUp } from "lucide-react"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"

/**
 * Accept-invite landing page.
 *
 * Supabase `admin.inviteUserByEmail` does NOT use PKCE. The email link
 * routes through `{supabase_url}/auth/v1/verify?token=...&type=invite`
 * and then redirects back to us with the session tokens placed in the
 * URL **hash fragment** (e.g. `#access_token=...&refresh_token=...&type=invite`).
 *
 * Hash fragments are not sent to the server, so a server-side route
 * handler (like `/auth/callback`) cannot read them — that's why the old
 * flow bounced to `/auth/error`. Instead we land here (client component)
 * where `@supabase/ssr`'s browser client auto-detects the session from
 * the URL (`detectSessionInUrl: true`), persists it to cookies, and
 * clears the hash. We then prompt the user to set a password and route
 * them to their dashboard based on their profile role.
 */
export default function AcceptInvitePage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // Kick off a getSession() call — by the time the Supabase client is
    // created on the client, it will have already parsed the hash and
    // written the session to storage. getSession() returns whatever is
    // currently in storage.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) {
        setSessionReady(true)
        setEmail(data.session.user.email ?? null)
      } else {
        setSessionReady(false)
      }
    })

    // Also listen for the auth state change event in case the hash
    // parsing hasn't finished by the time the effect ran.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return
        if (session) {
          setSessionReady(true)
          setEmail(session.user.email ?? null)
        }
      },
    )

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.")
      return
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Look up role to pick the right destination.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let redirectTo = "/client"
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      if (profile?.role && profile.role !== "client") {
        redirectTo = "/admin"
      }
    }

    setDone(true)
    setLoading(false)

    // Give the user a beat to see the success state, then route them in.
    setTimeout(() => {
      router.replace(redirectTo)
    }, 1200)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-8">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher variant="outline" />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Vexim Bridge</span>
        </div>

        <Card className="border-border shadow-sm">
          {done ? (
            <>
              <CardHeader className="pb-4">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-chart-4/10">
                  <CheckCircle2 className="h-5 w-5 text-chart-4" />
                </div>
                <CardTitle className="text-xl font-semibold">
                  Tài khoản đã sẵn sàng
                </CardTitle>
                <CardDescription>
                  Đang chuyển bạn vào hệ thống...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </>
          ) : sessionReady === false ? (
            <>
              <CardHeader className="pb-4">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-xl font-semibold">
                  Liên kết không hợp lệ
                </CardTitle>
                <CardDescription>
                  Link mời đã hết hạn hoặc đã được sử dụng. Vui lòng liên hệ
                  quản trị viên để nhận link mới.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/auth/login">
                  <Button className="w-full bg-primary text-primary-foreground">
                    Quay lại đăng nhập
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-semibold">
                  Chào mừng đến với Vexim Bridge
                </CardTitle>
                <CardDescription>
                  {email
                    ? `Thiết lập mật khẩu cho tài khoản ${email} để hoàn tất.`
                    : "Thiết lập mật khẩu để hoàn tất tài khoản của bạn."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Mật khẩu</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Ít nhất 8 ký tự"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="text-xs">{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || sessionReady === null}
                    className="w-full bg-primary text-primary-foreground"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      "Kích hoạt tài khoản"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
