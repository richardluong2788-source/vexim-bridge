import { redirect } from "next/navigation"
import { Inbox } from "lucide-react"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { createClient } from "@/lib/supabase/server"
import { getMyEngagements } from "@/app/admin/ae-inbox/engagement-actions"
import { loadAssignableClients } from "@/lib/buyers/engagement-queries"
import type { Engagement } from "@/lib/buyers/engagement-types"
import type { AssignableClient } from "@/lib/buyers/engagement-queries"
import { InboxWorkspace, type InboxTab } from "@/components/admin/inbox-workspace"

export const dynamic = "force-dynamic"

/**
 * The AE's inbox — one page, two queues.
 *
 * "Buyer của tôi" (AI-matched, waiting to be claimed) and "Đang xử lý" (claimed,
 * being worked) are the same job seen at two moments, and the AE used to cross
 * between two pages to do it. They are now tabs of this page, master–detail:
 * the queue on the left, the selected buyer on the right.
 *
 * `/admin/engagements` redirects here, so every existing link — the "buyer
 * replied" notifications, the stale-engagement cron, the matching pipeline's
 * "assigned to you" message — keeps working and lands on the right buyer.
 */
export default async function AEInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; focus?: string }>
}) {
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")

  // Only AEs and admins can access inbox
  const allowedRoles = [
    "admin",
    "super_admin",
    "account_executive",
    "lead_researcher",
  ]
  if (!allowedRoles.includes(current.role)) {
    redirect("/admin")
  }

  const sp = await searchParams
  const { locale } = await getDictionary()
  const supabase = await createClient()

  // Lead Researchers monitor matching but own no engagements: they get the
  // "Chờ nhận" queue only (the workspace hides the other tab for them).
  const canWork = current.role !== "lead_researcher"

  // --- Queue 1: buyers the matcher put in this AE's inbox -------------------
  let inboxQuery = supabase
    .from("ae_match_inbox")
    .select(
      `
      id,
      lead_id,
      account_manager_id,
      status,
      priority,
      rejection_reason,
      created_at,
      expires_at,
      leads (
        id,
        company_name,
        contact_person,
        country,
        industry,
        main_product,
        hs_code,
        hs_codes,
        product_keywords,
        has_active_inquiry,
        inquiry_products,
        inquiry_quantity,
        inquiry_target_price,
        inquiry_timeline,
        inquiry_channel
      ),
      profiles:account_manager_id (
        id,
        full_name,
        email
      ),
      ae_match_scores:match_score_id (
        id,
        total_score,
        product_match_score,
        industry_match_score,
        fda_compliance_score,
        workload_score,
        win_rate_score,
        country_match_score,
        factors
      )
    `,
    )
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })

  // AEs only see their own inbox items
  if (current.role === "account_executive") {
    inboxQuery = inboxQuery.eq("account_manager_id", current.userId)
  }

  const [{ data: inboxItems }, engagementResult, assignableClients] = await Promise.all([
    inboxQuery,
    // --- Queue 2: buyers already claimed and in flight ----------------------
    canWork ? getMyEngagements() : Promise.resolve(null),
    // Active clients (FDA in date) — shared with the shortlist builder and the
    // claim flow, so both queues offer the same suppliers.
    loadAssignableClients(supabase, {
      accountManagerId: current.role === "account_executive" ? current.userId : null,
    }),
  ])

  const engagements: Engagement[] =
    canWork && engagementResult?.ok ? (engagementResult.data as Engagement[]) : []

  const clients: AssignableClient[] = assignableClients

  const initialTab: InboxTab = sp.tab === "work" && canWork ? "work" : "pending"

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground text-balance">
              {locale === "vi" ? "Inbox" : "Inbox"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl text-pretty">
            {locale === "vi"
              ? "Buyer AI đề xuất cho bạn và buyer bạn đang xử lý, trong cùng một chỗ. Nhận buyer để hỏi nhu cầu, gửi shortlist supplier, rồi gán client khi buyer đã phản hồi."
              : "The buyers the matcher proposed for you and the ones you are working, in one place. Claim a buyer to gather requirements, send a supplier shortlist, then assign a client once the buyer responds."}
          </p>
        </div>
      </div>

      <InboxWorkspace
        pendingItems={inboxItems || []}
        engagements={engagements}
        clients={clients}
        locale={locale}
        currentRole={current.role}
        initialTab={initialTab}
        initialFocus={typeof sp.focus === "string" ? sp.focus : null}
      />
    </div>
  )
}
