/** Add whole weekdays while preserving the original local time. Saturday/Sunday are skipped. */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const result = new Date(from)
  let remaining = Math.max(0, Math.trunc(businessDays))
  while (remaining > 0) {
    result.setDate(result.getDate() + 1)
    const day = result.getDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return result
}
