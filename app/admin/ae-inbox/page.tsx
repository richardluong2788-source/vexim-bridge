import { redirect } from "next/navigation"
import { Inbox, Sparkles } from "lucide-react"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { createClient } from "@/lib/supabase/server"
import { InboxList } from "./inbox-list"

export const dynamic = "force-dynamic"

export default async function AEInboxPage() {
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

  const { locale } = await getDictionary()
  const supabase = await createClient()

  // Fetch inbox items based on role
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
    `
    )
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })

  // AEs only see their own inbox items
  if (current.role === "account_executive") {
    inboxQuery = inboxQuery.eq("account_manager_id", current.userId)
  }

  const { data: inboxItems } = await inboxQuery

  // Fetch clients for assignment (only those managed by this AE or all for admins)
  let clientsQuery = supabase
    .from("profiles")
    .select("id, full_name, company_name, fda_expires_at")
    .eq("role", "client")
    .order("company_name")

  if (current.role === "account_executive") {
    clientsQuery = clientsQuery.eq("account_manager_id", current.userId)
  }

  const { data: clients } = await clientsQuery

  // Filter to only FDA-valid clients
  const validClients = (clients || []).filter((c) => {
    if (!c.fda_expires_at) return false
    return new Date(c.fda_expires_at) > new Date()
  })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground text-balance">
              {locale === "vi" ? "Buyer của tôi" : "My Buyers"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl text-pretty">
            {locale === "vi"
              ? "Danh sách buyer được AI phân bổ cho bạn dựa trên sản phẩm, ngành hàng, và lịch sử thắng. Nhận buyer để hỏi nhu cầu, gửi shortlist supplier, rồi gán client khi buyer đã phản hồi."
              : "Buyers assigned to you by AI based on product fit, industry, and win history. Claim a buyer to gather requirements, send a supplier shortlist, then assign a client once the buyer responds."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>
            {locale === "vi"
              ? `${inboxItems?.length || 0} đề xuất đang chờ`
              : `${inboxItems?.length || 0} pending matches`}
          </span>
        </div>
      </div>

      <InboxList
        items={inboxItems || []}
        clients={validClients}
        locale={locale}
        currentRole={current.role}
      />
    </div>
  )
}
