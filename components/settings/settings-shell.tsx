"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, UserRound, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import { SettingsPageHeader } from "./settings-page-header"

interface SettingsShellProps {
  /** Where "Back to dashboard" points — resolved server-side from the role. */
  backHref: string
  children: React.ReactNode
}

interface SettingsTab {
  href: string
  labelKey: "profile" | "notifications"
  icon: LucideIcon
}

const TABS: SettingsTab[] = [
  { href: "/settings/profile", labelKey: "profile", icon: UserRound },
  { href: "/settings/notifications", labelKey: "notifications", icon: Bell },
]

/**
 * Shared chrome for every `/settings/*` page: back link, title and the tab
 * switcher. Pages render their own content only.
 *
 * This shell exists because settings grew a second tab — before that each
 * page carried its own copy of the header and there was nowhere to switch
 * between "my profile" and "notifications".
 */
export function SettingsShell({ backHref, children }: SettingsShellProps) {
  const { t } = useTranslation()
  const pathname = usePathname()

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <SettingsPageHeader backHref={backHref} subtitle={t.settings.subtitleGeneral} />

      <nav
        aria-label={t.settings.title}
        className="mb-8 flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map(({ href, labelKey, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.nav_extra[labelKey]}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
