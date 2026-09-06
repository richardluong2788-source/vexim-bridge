/**
 * Inquiry channel labels — migration 068 (leads.inquiry_channel).
 *
 * Used by:
 *   - AE inbox card (app/admin/ae-inbox/inbox-list.tsx)
 *   - Buyer detail view (components/admin/buyer-detail-view.tsx)
 *   - SmartLeadForm select (components/admin/smart-lead-form.tsx) — values only
 */

export const INQUIRY_CHANNELS = [
  "email",
  "phone",
  "zalo",
  "whatsapp",
  "linkedin",
  "trade_fair",
  "referral",
  "other",
] as const

export type InquiryChannel = (typeof INQUIRY_CHANNELS)[number]

export const INQUIRY_CHANNEL_LABELS: Record<
  InquiryChannel,
  { vi: string; en: string }
> = {
  email: { vi: "Email", en: "Email" },
  phone: { vi: "Điện thoại", en: "Phone" },
  zalo: { vi: "Zalo", en: "Zalo" },
  whatsapp: { vi: "WhatsApp", en: "WhatsApp" },
  linkedin: { vi: "LinkedIn", en: "LinkedIn" },
  trade_fair: { vi: "Hội chợ / Triển lãm", en: "Trade fair" },
  referral: { vi: "Giới thiệu", en: "Referral" },
  other: { vi: "Khác", en: "Other" },
}

/** Display label with locale fallback; unknown values pass through as-is. */
export function inquiryChannelLabel(
  channel: string | null | undefined,
  locale: "vi" | "en",
): string {
  if (!channel) return ""
  const entry = INQUIRY_CHANNEL_LABELS[channel as InquiryChannel]
  return entry ? entry[locale] : channel
}
