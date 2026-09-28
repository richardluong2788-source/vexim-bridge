"use client"

import { useRouter, usePathname } from "next/navigation"
import { isPublicPath, localizePath, splitLocalePrefix } from "@/lib/i18n/routing"
import { Globe } from "lucide-react"
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from "@/lib/i18n/config"
import { useTranslation } from "./language-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function LanguageSwitcher({
  variant = "ghost",
  className,
  compact = false,
}: {
  variant?: "ghost" | "outline" | "default"
  className?: string
  compact?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { locale, setLocale, t } = useTranslation()

  const handleChange = (next: Locale) => {
    if (next === locale) return
    // Always persist the cookie: the signed-in app (`/admin`, `/settings`, …) has
    // no locale prefix and switches language through it.
    setLocale(next)

    if (isPublicPath(pathname)) {
      // Public pages have real locale URLs, so move the address bar to the
      // translated path instead of relying on a cookie a crawler never sends.
      // Query string is carried over so a filtered catalog view survives.
      const { pathname: bare } = splitLocalePrefix(pathname)
      const search = typeof window === "undefined" ? "" : window.location.search
      router.push(`${localizePath(bare === "" ? "/" : bare, next)}${search}`)
      return
    }

    // Refresh server components so their getDictionary() re-reads the cookie.
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={compact ? "icon" : "sm"}
          className={cn(compact ? "h-9 w-9" : "gap-2", className)}
          aria-label={t.language.switchTo}
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          {!compact && <span className="text-sm font-medium">{LOCALE_SHORT[locale]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t.language.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => handleChange(code)}
            className={cn(
              "flex items-center justify-between gap-2",
              code === locale && "font-semibold text-accent",
            )}
          >
            <span>{LOCALE_LABELS[code]}</span>
            <span className="text-xs text-muted-foreground">{LOCALE_SHORT[code]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
