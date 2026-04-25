/**
 * Link-driven tab navigation for /admin/analytics. We keep tab state in the
 * URL (?tab=...) so refresh / back-forward / sharing all work out of the
 * box, and the server can fetch only the data the active tab needs.
 */
import Link from "next/link"
import { cn } from "@/lib/utils"

export type AnalyticsTab = "overview" | "clients" | "bottleneck" | "lost"

const TABS: { value: AnalyticsTab; label: string }[] = [
  { value: "overview",   label: "Tổng quan" },
  { value: "clients",    label: "Theo Client" },
  { value: "bottleneck", label: "Đang tắc" },
  { value: "lost",       label: "Phân tích thất bại" },
]

interface Props {
  current: AnalyticsTab
  /** Carry over the period query param so switching tabs preserves it. */
  period: string
}

export function AnalyticsTabsNav({ current, period }: Props) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border">
      {TABS.map((tab) => {
        const isActive = current === tab.value
        return (
          <Link
            key={tab.value}
            href={`/admin/analytics?tab=${tab.value}&period=${period}`}
            scroll={false}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function parseTab(raw: string | undefined | null): AnalyticsTab {
  switch (raw) {
    case "overview":
    case "clients":
    case "bottleneck":
    case "lost":
      return raw
    default:
      return "overview"
  }
}
