/**
 * Server-safe parser + type for the /client/analytics tab query param.
 *
 * Kept in `lib/` (no "use client" directive) so it can be imported from
 * the server page (`app/client/analytics/page.tsx`) without tripping the
 * Next.js "client function called from server" boundary check.
 */

export type ClientAnalyticsTab =
  | "overview"
  | "pipeline"
  | "winloss"
  | "financial"

export const CLIENT_ANALYTICS_TAB_ORDER: ClientAnalyticsTab[] = [
  "overview",
  "pipeline",
  "winloss",
  "financial",
]

export function parseClientTab(
  raw: string | undefined | null,
): ClientAnalyticsTab {
  switch (raw) {
    case "overview":
    case "pipeline":
    case "winloss":
    case "financial":
      return raw
    default:
      return "overview"
  }
}
