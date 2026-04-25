"use client"

/**
 * URL-driven tabs nav for /client/analytics. The active tab is stored in
 * `?tab=` so refresh / share / back-forward all behave correctly. We must
 * be a client component to access the `useTranslation` hook for label
 * localisation.
 *
 * The `parseClientTab` helper + type live in `lib/analytics/client-tabs.ts`
 * so the server page can import them without crossing the client/server
 * function boundary.
 */
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  CLIENT_ANALYTICS_TAB_ORDER,
  type ClientAnalyticsTab,
} from "@/lib/analytics/client-tabs"

interface Props {
  current: ClientAnalyticsTab
  /** Carry over the current period so switching tabs preserves it. */
  period: string
}

export function ClientAnalyticsTabsNav({ current, period }: Props) {
  const { t } = useTranslation()
  const labels = t.client.analytics.tabs

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-border"
      aria-label="Analytics sections"
    >
      {CLIENT_ANALYTICS_TAB_ORDER.map((tab) => {
        const isActive = current === tab
        return (
          <Link
            key={tab}
            href={`/client/analytics?tab=${tab}&period=${period}`}
            scroll={false}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {labels[tab]}
          </Link>
        )
      })}
    </nav>
  )
}
