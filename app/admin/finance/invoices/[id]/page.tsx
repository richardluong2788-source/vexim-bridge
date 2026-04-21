import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CheckCircle2, Clock, Mail } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { InvoicePrintable } from "@/components/finance/invoice-printable"
import { InvoiceActionBar } from "@/components/admin/finance/invoice-action-bar"
import { formatDateTime } from "@/lib/finance/format"
import type { Invoice, Profile } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return "http://localhost:3000"
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.FINANCE_READ)) redirect("/admin")
  const admin = current.admin
  const { data: invoice } = await admin
    .from("invoices" as never)
    .select("*, profiles:client_id (id, full_name, company_name, email)")
    .eq("id", id)
    .maybeSingle()

  if (!invoice) return notFound()

  // Type assertion for the joined row.
  type Row = Invoice & {
    profiles: Pick<Profile, "id" | "full_name" | "company_name" | "email"> | null
  }
  const inv = invoice as unknown as Row
  const publicUrl = `${getAppUrl()}/invoice/${inv.public_token}`

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8 print:p-0 print:max-w-full">
      <div className="print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/finance/invoices">
            <ArrowLeft className="h-4 w-4" />
            Danh sách hóa đơn
          </Link>
        </Button>
      </div>

      <div className="print:hidden">
        <InvoiceActionBar invoice={inv} publicUrl={publicUrl} />
      </div>

      <Card className="border-border print:hidden">
        <CardContent className="flex flex-wrap gap-4 p-4 text-sm">
          <Meta
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email gần nhất"
            value={inv.email_sent_at ? formatDateTime(inv.email_sent_at, "vi") : "Chưa gửi"}
          />
          <Separator orientation="vertical" className="h-5" />
          <Meta
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Tạo lúc"
            value={formatDateTime(inv.created_at, "vi")}
          />
          {inv.paid_at && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <Meta
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                label="Đã thu lúc"
                value={formatDateTime(inv.paid_at, "vi")}
              />
              {inv.payment_reference && (
                <>
                  <Separator orientation="vertical" className="h-5" />
                  <Meta
                    label="Mã giao dịch"
                    value={inv.payment_reference}
                    mono
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <InvoicePrintable invoice={inv} client={inv.profiles} locale="vi" />
    </div>
  )
}

function Meta({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className={mono ? "font-mono text-xs" : "text-xs font-medium"}>
        {value}
      </span>
    </div>
  )
}
