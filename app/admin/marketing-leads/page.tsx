import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS } from "@/lib/auth/permissions"
import { getDictionary } from "@/lib/i18n/server"
import { Card, CardContent } from "@/components/ui/card"
import {
  MarketingLeadsList,
  type MarketingLeadItem,
} from "@/components/admin/marketing-leads-list"

export const dynamic = "force-dynamic"

/**
 * /admin/marketing-leads — the queue behind every public form.
 *
 * Before migration 082 the landing consultation form only emailed the team, so
 * an inbound supplier enquiry had no owner, no status and no expiry: whoever
 * read the email first (if anyone) dealt with it, and nothing recorded that it
 * happened. This page is the other half of that fix — a row that is not listed
 * here would still be invisible money.
 *
 * Audience split matters: `supplier` rows are sourcing leads for SR/AE (a
 * factory asking to be represented), while `buyer` rows — created by the EN
 * marketing pages once they exist — are demand that should end up in
 * `public.leads` via the normal matching gate, not here.
 */
export default async function MarketingLeadsPage() {
  const { locale } = await getDictionary()
  const vi = locale === "vi"

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role, userId } = current

  if (!can(role, CAPS.MARKETING_LEADS_VIEW)) redirect("/admin")
  const canTriage = can(role, CAPS.MARKETING_LEADS_TRIAGE)

  // Explicit projection, not `select("*")`: this list is rendered by a client
  // component, so every selected column is serialized into the RSC payload and
  // shipped to the browser. user_agent / ip_hash / raw_payload stay server-side.
  const { data, error } = await admin
    .from("marketing_leads")
    .select(
      [
        "id",
        "created_at",
        "audience",
        "source",
        "status",
        "reference",
        "full_name",
        "email",
        "phone",
        "company_name",
        "industry",
        "preferred_time",
        "message",
        "locale",
        "page_path",
        "referrer",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "notes",
        "last_contacted_at",
        "assigned_to",
      ].join(", "),
    )
    .order("created_at", { ascending: false })
    .limit(300)

  const rows = (error ? [] : (data ?? [])) as unknown as Array<
    Omit<MarketingLeadItem, "assignee_name">
  >

  // Resolve owner names in one extra query instead of an FK embed — the embed
  // couples this page to Postgres' default constraint name, which a future
  // migration could rename.
  const assigneeIds = Array.from(
    new Set(rows.map((r) => r.assigned_to).filter((v): v is string => Boolean(v))),
  )
  const nameById = new Map<string, string | null>()
  if (assigneeIds.length > 0) {
    const { data: people } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", assigneeIds)
    for (const person of (people ?? []) as Array<{ id: string; full_name: string | null }>) {
      nameById.set(person.id, person.full_name)
    }
  }

  const items: MarketingLeadItem[] = rows.map((r) => ({
    ...r,
    assignee_name: r.assigned_to ? (nameById.get(r.assigned_to) ?? null) : null,
  }))

  const openCount = items.filter((i) => i.status === "new").length
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekCount = items.filter((i) => new Date(i.created_at).getTime() >= weekAgo).length
  const staleCount = items.filter(
    (i) => i.status === "new" && new Date(i.created_at).getTime() < weekAgo,
  ).length

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {vi ? "Lead từ website" : "Website leads"}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {vi
            ? "Mọi submission từ form công khai (đăng ký tư vấn trên landing, form RFQ cho buyer Mỹ) đều được ghi ở đây trước khi gửi email — email có thể vào spam, row này thì không."
            : "Every submission from a public form (landing consultation, US-buyer RFQ) is written here before any email goes out — mail can land in spam, this row cannot."}
        </p>
      </div>

      {error && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {vi
                  ? "Không đọc được bảng marketing_leads — có vẻ migration 082 chưa được chạy."
                  : "Could not read marketing_leads — migration 082 has probably not been applied."}
              </p>
              <p className="text-xs opacity-80">
                {vi
                  ? "Chạy scripts/082_marketing_leads.sql trên Supabase. Form vẫn gửi email bình thường, chỉ là chưa có bản ghi."
                  : "Run scripts/082_marketing_leads.sql in Supabase. The form still emails, there is simply no stored copy yet."}
              </p>
              <p className="font-mono text-xs opacity-70">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={vi ? "Đang chờ triage" : "Awaiting triage"}
          value={openCount}
          hint={vi ? "status = new" : "status = new"}
        />
        <StatCard
          label={vi ? "7 ngày qua" : "Last 7 days"}
          value={weekCount}
          hint={vi ? "lead mới nhận" : "newly captured"}
        />
        <StatCard
          label={vi ? "Quá 7 ngày chưa ai chạm" : "Untouched > 7 days"}
          value={staleCount}
          hint={vi ? "cần gán người xử lý" : "needs an owner"}
          warn={staleCount > 0}
        />
      </div>

      <MarketingLeadsList
        items={items}
        locale={locale}
        canTriage={canTriage}
        currentUserId={userId}
      />

      <p className="text-xs text-muted-foreground">
        {vi ? (
          <>
            Lead có audience = <code className="font-mono">buyer</code> nên được chuyển sang{" "}
            <Link href="/admin/buyers" className="text-primary underline-offset-2 hover:underline">
              Buyer
            </Link>{" "}
            để AI matching chạy đúng cổng — không tự thêm tay vào bảng đó.
          </>
        ) : (
          <>
            Leads with audience = <code className="font-mono">buyer</code> should be converted into{" "}
            <Link href="/admin/buyers" className="text-primary underline-offset-2 hover:underline">
              Buyers
            </Link>{" "}
            so AI matching runs through its normal gate — do not hand-insert into that table.
          </>
        )}
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: number
  hint: string
  warn?: boolean
}) {
  return (
    <Card className={warn ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20" : "border-border"}>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </CardContent>
    </Card>
  )
}
