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

  // Supabase handles the token-for-session exchange automatically when
  // the user lands on this page via the reset email link (the link
  // contains a one-time code in the URL hash). We just need to wait for
  // the client to establish the session.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // If there's already a session, we're good.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSessionReady(!!data.session)
    })

    // Also listen for PASSWORD_RECOVERY event (fired when Supabase parses
    // the hash from the email link).
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(true)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
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
