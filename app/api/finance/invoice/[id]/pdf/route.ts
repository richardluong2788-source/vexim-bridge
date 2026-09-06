/**
 * GET /api/finance/invoice/[id]/pdf — tải hóa đơn PDF chuyên nghiệp.
 *
 * Guard: FINANCE_READ. Trả về file PDF (attachment) với tên
 * `Hoa-don-<invoice_number>.pdf`.
 */

import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { loadFinanceSettings } from "@/lib/finance/settings"
import { renderInvoicePdf } from "@/lib/finance/invoice-pdf"
import type { Invoice, Profile } from "@/lib/supabase/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const current = await getCurrentRole()
  if (!current) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!can(current.role, CAPS.FINANCE_READ)) {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  const admin = current.admin
  const { data: invoice } = await admin
    .from("invoices")
    .select("*, profiles:client_id (id, full_name, company_name, email)")
    .eq("id", id)
    .maybeSingle()

  if (!invoice) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }

  const settings = await loadFinanceSettings()
  const bytes = await renderInvoicePdf({
    invoice: invoice as unknown as Invoice,
    client: (invoice as unknown as { profiles: Pick<Profile, "id" | "full_name" | "company_name" | "email"> | null }).profiles,
    settings,
  })

  const inv = invoice as unknown as Invoice
  const filename = `Hoa-don-${inv.invoice_number}.pdf`

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
