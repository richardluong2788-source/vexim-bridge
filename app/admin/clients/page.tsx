import Link from "next/link"
import { UserPlus, Download } from "lucide-react"
import { ClientsTable } from "@/components/admin/clients-table"
import { getDictionary } from "@/lib/i18n/server"
import { Button } from "@/components/ui/button"
import { ScopeBanner } from "@/components/admin/scope-banner"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, canAll, CAPS, ROLE_META } from "@/lib/auth/permissions"
import { ownershipScopeFor } from "@/lib/auth/scope"
import type { ManagerOption } from "@/components/admin/account-manager-select"
import type { Role } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

const STAFF_ROLES: Role[] = [
  "super_admin",
  "admin",
  "account_executive",
  "lead_researcher",
  "finance",
  "staff",
]

/**
 * Short role tag shown on each manager option.
 * "Lead Researcher" -> "Researcher" so the dropdown stays narrow.
 */
const ROLE_SHORT: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  account_executive: "AE",
  lead_researcher: "Researcher",
  finance: "Finance",
  staff: "Staff",
  client: "Client",
}

export default async function AdminClientsPage() {
  const { t, locale } = await getDictionary()

  // Use the service-role client (already inside `current`) to avoid the
  // RLS recursion on `profiles` and to keep the page fast.
  const current = await getCurrentRole()
  if (!current) {
    return null
  }
  const { admin, role, userId } = current
  // Only roles with OWNERSHIP_BYPASS may reassign — see
  // setAccountManager() server action for the matching server-side check.
  const canAssignManager = canAll(role, [CAPS.CLIENT_WRITE, CAPS.OWNERSHIP_BYPASS])
  // The clients query below is already scoped to owned clients for
  // AE/Lead Researcher, so CLIENT_WRITE alone is enough to let them edit
  // fields (email, FDA, country) on the rows they can see.
  const canEditClient = can(role, CAPS.CLIENT_WRITE)
  const isSuperAdmin = role === "super_admin"
  // AEs can create clients (they will auto-become account manager)
  const canCreateClient = can(role, CAPS.CLIENT_WRITE) || role === "account_executive"
  const scope = ownershipScopeFor(role, userId)

  // Build the client query. AEs without OWNERSHIP_BYPASS only see clients
  // assigned to them via profiles.account_manager_id.
  let clientsQ = admin
    .from("profiles")
    .select("*, client_profiles(display_name)")
    .eq("role", "client")
    .order("created_at", { ascending: false })
  if (scope.kind === "owned") {
    clientsQ = clientsQ.eq("account_manager_id", scope.userId)
  }

  const [{ data: clients }, { data: staff }, { data: assessments }] = await Promise.all([
    clientsQ,
    admin
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", STAFF_ROLES)
      .order("full_name", { ascending: true }),
    admin
      .from("client_factory_assessments")
      .select("client_id, score_total, score_grade"),
  ])

  // Map client_id -> { score_total, score_grade } de hien thi badge
  const assessmentMap: Record<string, { score_total: number | null; score_grade: string | null }> =
    Object.fromEntries(
      ((assessments ?? []) as Array<{
        client_id: string
        score_total: number | null
        score_grade: string | null
      }>).map((a) => [a.client_id, { score_total: a.score_total, score_grade: a.score_grade }])
    )

  // Build the dropdown option list once; each row reuses the same array.
  const staffList = (staff ?? []) as Array<{
    id: string
    full_name: string | null
    email: string | null
    role: string | null
  }>
  const managers: ManagerOption[] = staffList
    .filter((s) => s.role && STAFF_ROLES.includes(s.role as Role))
    .map((s) => {
      const r = s.role as Role
      return {
        id: s.id,
        label: s.full_name?.trim() || s.email || "—",
        roleLabel: ROLE_SHORT[r] ?? ROLE_META[r]?.label ?? r,
      }
    })

  // Cheap lookup so non-editors see the manager name without hydrating
  // the full Select component.
  const managerLabels: Record<string, string> = Object.fromEntries(
    managers.map((m) => [m.id, m.label]),
  )

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{t.admin.clients.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.clients.subtitle}</p>
          {scope.kind === "owned" && (
            <ScopeBanner
              locale={locale}
              count={clients?.length ?? 0}
              entityVi="khách hàng"
              entityEn="clients"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a href="/api/export/clients" download>
              <Download className="mr-2 h-4 w-4" />
              {locale === "vi" ? "Tải CSV" : "Export CSV"}
            </a>
          </Button>
          {canCreateClient && (
            <Button asChild>
              <Link href="/admin/clients/new">
                <UserPlus className="mr-2 h-4 w-4" />
                {locale === "vi" ? "Thêm khách hàng" : "New Client"}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <ClientsTable
        clients={clients ?? []}
        managers={managers}
        managerLabels={managerLabels}
        canAssignManager={canAssignManager}
        canEditClient={canEditClient}
        isSuperAdmin={isSuperAdmin}
        assessmentMap={assessmentMap}
      />
    </div>
  )
}
