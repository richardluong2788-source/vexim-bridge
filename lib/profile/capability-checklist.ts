import type { Locale } from "@/lib/i18n/config"
import { getProfileCopy } from "@/lib/profile/translations"
import type { PublicCapability } from "@/lib/assessment/actions"

/**
 * Build the verified-capability checklist using the active profile language.
 * Only safety, quality-system and traceability signals are included; internal
 * scores and staffing details are never exposed on the public profile.
 */
export function buildVerifiedCapabilityChecklist(
  capability: PublicCapability | null | undefined,
  locale: Locale = "vi",
): string[] {
  if (!capability) return []

  const labels = getProfileCopy(locale).capabilityLabels
  const items: string[] = []

  for (const value of capability.quality_systems ?? []) {
    const label = labels.qualitySystems[value]
    if (label) items.push(label)
  }

  for (const value of capability.traceability ?? []) {
    if (value === "none") continue
    const label = labels.traceability[value]
    if (label) items.push(label)
  }

  return items
}
