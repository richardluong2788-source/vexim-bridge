import { UserCheck } from "lucide-react"

interface ScopeBannerProps {
  locale: "vi" | "en"
  count: number
  /** Vietnamese entity label, lower-cased ("khách hàng", "deal"). */
  entityVi: string
  /** English entity label, lower-cased ("clients", "deals"). */
  entityEn: string
}

/**
 * Subtle banner that appears on every list page when the current user is
 * scoped to "owned" records. Reuses the existing muted/border tokens so it
 * blends into the page without screaming for attention. Shows the row count
 * so the AE knows whether the empty state is "I have nothing" vs "filter
 * is wrong".
 */
export function ScopeBanner({ locale, count, entityVi, entityEn }: ScopeBannerProps) {
  const message =
    locale === "vi"
      ? `Phạm vi: chỉ ${entityVi} được giao cho bạn (${count}).`
      : `Scope: only ${entityEn} assigned to you (${count}).`
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
      <UserCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
