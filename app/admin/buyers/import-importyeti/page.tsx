import { redirect } from "next/navigation"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { getDictionary } from "@/lib/i18n/server"
import { ImportYetiImporter } from "@/components/admin/importyeti-importer"

export const dynamic = "force-dynamic"

/**
 * Admin-only page — paste raw text from ImportYeti, AI parses it into
 * structured buyers, admin reviews & saves. The flow does NOT scrape
 * ImportYeti server-side; the admin opens the page in their own browser.
 */
export default async function ImportYetiBuyerImportPage() {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.BUYER_WRITE)) redirect("/admin/buyers")

  const { locale } = await getDictionary()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground text-balance">
          {locale === "vi"
            ? "Import buyer từ ImportYeti"
            : "Import buyers from ImportYeti"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl text-pretty leading-relaxed">
          {locale === "vi"
            ? "Mở importyeti.com trong trình duyệt của bạn, copy toàn bộ trang công ty buyer (Ctrl+A → Ctrl+C), dán vào ô bên dưới. AI sẽ bóc tách công ty, top supplier, HS code, cảng nhập và tần suất nhập 12 tháng gần nhất. Buyer được lưu vào danh bạ — chưa gán cho client nào."
            : "Open importyeti.com in your own browser, copy the entire buyer page (Ctrl+A → Ctrl+C), and paste it below. The AI extracts the buyer company, top suppliers, HS codes, ports, and the 12-month shipment count. Buyers are saved to the directory — they are not yet assigned to any Vietnamese client."}
        </p>
      </div>
      <ImportYetiImporter locale={locale} />
    </div>
  )
}
