import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { CAPS } from "@/lib/auth/permissions"
import { UnmatchedEmailList, type UnmatchedEmailListItem } from "@/components/admin/unmatched-email-list"

export const dynamic = "force-dynamic"

export default async function UnmatchedEmailsPage() {
  const { t } = await getDictionary()

  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  const { admin, role } = current

  // Same capability as the activity log — this is a triage/audit surface,
  // not something ordinary AEs need in their day-to-day flow.
  if (!can(role, CAPS.ACTIVITY_LOG_VIEW)) redirect("/admin")

  const { data, error } = await admin
    .from("unmatched_inbound_emails")
    .select(
      `
      id,
      from_email,
      to_emails,
      subject,
      raw_content,
      match_attempt_note,
      received_at,
      reviewed,
      reviewed_at,
      review_note,
      reviewer:profiles!unmatched_inbound_emails_reviewed_by_fkey(full_name, email)
      `,
    )
    .order("received_at", { ascending: false })
    .limit(200)

  const items = (error ? [] : (data ?? [])) as unknown as UnmatchedEmailListItem[]

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.unmatchedEmails.title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.admin.unmatchedEmails.subtitle}</p>
      </div>

      <UnmatchedEmailList items={items} />
    </div>
  )
}
