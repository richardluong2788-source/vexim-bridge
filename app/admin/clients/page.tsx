import Link from "next/link"
import { UserPlus, Download } from "lucide-react"
import { ClientsTable } from "@/components/admin/clients-table"
import { getDictionary } from "@/lib/i18n/server"
import { Button } from "@/components/ui/button"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS, ROLE_META } from "@/lib/auth/permissions"
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
  const { admin, role } = current
  const canAssignManager = can(role, CAPS.CLIENT_WRITE)

  const [{ data: clients }, { data: staff }] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("role", "client")
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", STAFF_ROLES)
      .order("full_name", { ascending: true }),
  ])

  // Build the dropdown option list once; each row reuses the same array.
  const managers: ManagerOption[] = (staff ?? [])
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
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.admin.clients.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.admin.clients.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a href="/api/export/clients" download>
              <Download className="mr-2 h-4 w-4" />
              {locale === "vi" ? "Tải CSV" : "Export CSV"}
            </a>
          </Button>
          {canAssignManager && (
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
      />
    </div>
  )
}
