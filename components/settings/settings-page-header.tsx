"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "@/components/i18n/language-provider"

interface SettingsPageHeaderProps {
  /**
   * Where "Back to dashboard" should point. Resolved on the server from the
   * caller's role so we don't need another round-trip on the client.
   */
  backHref: string
}

export function SettingsPageHeader({ backHref }: SettingsPageHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.unsubscribe.backToApp}
      </Link>

      <h1 className="mt-4 text-3xl font-semibold text-foreground text-balance">
        {t.settings.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        {t.settings.subtitle}
      </p>
    </div>
  )
}
