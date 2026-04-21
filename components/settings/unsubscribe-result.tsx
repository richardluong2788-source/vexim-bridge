"use client"

import Link from "next/link"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/i18n/language-provider"

interface Props {
  status: "success" | "invalid"
}

export function UnsubscribeResult({ status }: Props) {
  const { t } = useTranslation()

  const isSuccess = status === "success"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              isSuccess ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <AlertCircle className="h-6 w-6" />
            )}
          </div>

          <h1 className="mt-5 text-xl font-semibold text-foreground text-balance">
            {isSuccess ? t.unsubscribe.successTitle : t.unsubscribe.invalidTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            {isSuccess ? t.unsubscribe.successDesc : t.unsubscribe.invalidDesc}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/settings/notifications">
                {isSuccess ? t.unsubscribe.reenable : t.unsubscribe.manage}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/">{t.unsubscribe.backToApp}</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Vexim Bridge
        </div>
      </div>
    </div>
  )
}
