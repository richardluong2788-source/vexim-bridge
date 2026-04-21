"use client"

import { useState } from "react"
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

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    )

    // We intentionally show the same success UI whether the email exists
    // or not — prevents email enumeration. Only surface transport errors.
    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }
    setSent(true)
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
          {sent ? (
            <>
              <CardHeader className="pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-4/10 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-chart-4" />
                </div>
                <CardTitle className="text-xl font-semibold">
                  {t.auth.forgotPassword.successTitle}
                </CardTitle>
                <CardDescription>{t.auth.forgotPassword.successDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    {t.auth.forgotPassword.backToLogin}
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-semibold">
                  {t.auth.forgotPassword.title}
                </CardTitle>
                <CardDescription>{t.auth.forgotPassword.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">{t.auth.forgotPassword.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t.auth.forgotPassword.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
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
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.auth.forgotPassword.loading}
                      </>
                    ) : (
                      t.auth.forgotPassword.submit
                    )}
                  </Button>

                  <Link
                    href="/auth/login"
                    className="text-sm text-muted-foreground hover:text-foreground text-center"
                  >
                    {t.auth.forgotPassword.backToLogin}
                  </Link>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
