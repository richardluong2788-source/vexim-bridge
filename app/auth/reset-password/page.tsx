"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
import { useTranslation } from "@/components/i18n/language-provider"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)

  // The recovery link minted by `admin.auth.admin.generateLink({ type:
  // "recovery" })` routes through Supabase's /auth/v1/verify endpoint and
  // redirects back here with the session tokens in the URL hash fragment
  // (`#access_token=...&refresh_token=...&type=recovery`). The browser
  // client created by @supabase/ssr forces PKCE and therefore only
  // auto-detects `?code=` query params — not hash fragments — so we parse
  // the hash manually (same approach as the accept-invite page) and hand
  // the tokens to setSession.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function bootstrap() {
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash
        const params = new URLSearchParams(hash)

        const hashError = params.get("error_description") || params.get("error")
        if (hashError) {
          if (!cancelled) setSessionReady(false)
          return
        }

        const accessToken = params.get("access_token")
        const refreshToken = params.get("refresh_token")

        if (accessToken && refreshToken) {
          const { data, error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          // Clean the tokens out of the URL so a refresh doesn't reuse them
          // and so they don't leak into browser history / referrer.
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          )

          if (!cancelled) {
            setSessionReady(setErr || !data.session ? false : true)
          }
          return
        }
      }

      // No hash tokens — fall back to whatever is already in storage (e.g.
      // after a refresh once we cleared the hash above).
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSessionReady(!!data.session)
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t.auth.resetPassword.tooShort)
      return
    }
    if (password !== confirmPassword) {
      setError(t.auth.resetPassword.mismatch)
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
    setDone(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen bg-background items-center justify-center p-8 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="outline" />
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">{t.app.name}</span>
        </div>

        <Card className="border-border shadow-sm">
          {done ? (
            <>
              <CardHeader className="pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-4/10 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-chart-4" />
                </div>
                <CardTitle className="text-xl font-semibold">
                  {t.auth.resetPassword.successTitle}
                </CardTitle>
                <CardDescription>{t.auth.resetPassword.successDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/auth/login">
                  <Button className="w-full bg-primary text-primary-foreground">
                    {t.auth.forgotPassword.backToLogin}
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : sessionReady === false ? (
            <>
              <CardHeader className="pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 mb-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-xl font-semibold">
                  {t.auth.error.title}
                </CardTitle>
                <CardDescription>{t.auth.resetPassword.invalidLink}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/auth/forgot-password">
                  <Button className="w-full bg-primary text-primary-foreground">
                    {t.auth.forgotPassword.submit}
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-semibold">
                  {t.auth.resetPassword.title}
                </CardTitle>
                <CardDescription>{t.auth.resetPassword.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">{t.auth.resetPassword.password}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={t.auth.resetPassword.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirmPassword">
                      {t.auth.resetPassword.confirmPassword}
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder={t.auth.resetPassword.confirmPlaceholder}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
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
                        {t.auth.resetPassword.loading}
                      </>
                    ) : (
                      t.auth.resetPassword.submit
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
