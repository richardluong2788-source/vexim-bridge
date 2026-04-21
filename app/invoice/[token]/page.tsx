import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { InvoicePrintable } from "@/components/finance/invoice-printable"
import { PrintButton } from "@/components/finance/print-button"
import type { Invoice, Profile } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ token: string }>
}

type Row = Invoice & {
  profiles: Pick<Profile, "full_name" | "company_name" | "email"> | null
}

/**
 * Public, token-protected invoice view. No auth required — the UUID
 * token in the URL is the security boundary. Clients open this via
 * the "View full invoice" link in their email.
 *
 * We intentionally do NOT index these pages (robots noindex) and do
 * NOT expose internal IDs.
 */
export default async function PublicInvoicePage({ params }: Props) {
  const { token } = await params

  // Basic shape validation so malformed tokens don't hit the DB.
  if (!/^[0-9a-f-]{36}$/i.test(token)) return notFound()

  const admin = createAdminClient()
  const { data } = await admin
    .from("invoices" as never)
    .select("*, profiles:client_id (full_name, company_name, email)")
    .eq("public_token", token)
    .maybeSingle()

  if (!data) return notFound()
  const invoice = data as unknown as Row

  // Void / cancelled invoices shouldn't be viewable — confusing for recipients.
  if (invoice.status === "void") return notFound()

  return (
    <div className="min-h-screen bg-muted/30 py-10 print:bg-white print:py-0">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 print:px-0">
        <div className="flex items-center justify-end print:hidden">
          <PrintButton />
        </div>
        <InvoicePrintable
          invoice={invoice}
          client={invoice.profiles}
          locale="vi"
        />
        <p className="text-center text-xs text-muted-foreground mt-4 print:hidden">
          Link này chỉ dành cho người nhận hóa đơn. Vui lòng không chia sẻ công khai.
        </p>
      </div>
    </div>
  )
}


