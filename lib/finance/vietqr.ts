/**
 * VietQR helper.
 *
 * Generates an image URL that renders a Napas 247 compatible QR code.
 * Scanning with any Vietnamese banking app auto-fills:
 *   - destination bank + account
 *   - transfer amount (VND)
 *   - memo / transfer description
 *
 * The user only needs to review & confirm, making this a zero-friction
 * payment path for retainer / setup-fee invoices.
 *
 * We use the public `img.vietqr.io` CDN which is a standard convention
 * for VietQR images — no API key, cached by CDN.
 *
 *   https://img.vietqr.io/image/{BIN}-{ACCOUNT}-{TEMPLATE}.png
 *     ?amount=...&addInfo=...&accountName=...
 */
export type VietQRTemplate = "compact" | "compact2" | "qr_only" | "print"

export interface VietQRParams {
  bankBin: string
  accountNo: string
  accountName?: string | null
  /** Amount in VND, integer. Leave undefined for a "no-amount" QR. */
  amountVnd?: number | null
  /** Transfer memo (VietQR field `addInfo`). Usually the invoice number. */
  memo?: string | null
  template?: VietQRTemplate
}

/**
 * Strip diacritics + disallowed chars. VietQR's addInfo/accountName fields
 * must be ASCII-ish for maximum banking-app compatibility.
 */
function normalizeForQr(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\w\s.\-_:/]/g, "")
    .trim()
    .slice(0, 100)
}

export function buildVietQrImageUrl(params: VietQRParams): string | null {
  const { bankBin, accountNo, accountName, amountVnd, memo } = params
  if (!bankBin || !accountNo) return null

  const template = params.template ?? "compact2"
  const base = `https://img.vietqr.io/image/${encodeURIComponent(
    bankBin,
  )}-${encodeURIComponent(accountNo)}-${template}.png`

  const qs = new URLSearchParams()
  if (typeof amountVnd === "number" && amountVnd > 0) {
    // VietQR expects VND as a plain integer.
    qs.set("amount", Math.round(amountVnd).toString())
  }
  if (memo) qs.set("addInfo", normalizeForQr(memo))
  if (accountName) qs.set("accountName", normalizeForQr(accountName))

  const query = qs.toString()
  return query ? `${base}?${query}` : base
}

/**
 * Convert a USD invoice amount to VND using the invoice's pinned FX rate.
 * Falls back to the settings default if the invoice doesn't have one.
 */
export function usdToVnd(
  amountUsd: number | null | undefined,
  fxRate: number | null | undefined,
): number | null {
  if (amountUsd == null || fxRate == null || fxRate <= 0) return null
  return Math.round(amountUsd * fxRate)
}
