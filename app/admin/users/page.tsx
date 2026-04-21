import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"
import { UsersTable } from "@/components/admin/users-table"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentRole } from "@/lib/auth/guard"
import { can, CAPS, ROLE_META, normaliseRole } from "@/lib/auth/permissions"
import type { Role } from "@/lib/supabase/types"

export default async function UsersPage() {
  const { t, locale } = await getDictionary()

  // Access gate — only roles with USERS_VIEW may open this page.
  const current = await getCurrentRole()
  if (!current) redirect("/auth/login")
  if (!can(current.role, CAPS.USERS_VIEW)) redirect("/admin")

  // Use the service-role client (already inside `current`) to avoid RLS
  // recursion on profiles.
  const { data: profiles } = await current.admin
    .from("profiles")
    .select("id, email, full_name, role, company_name, created_at")
    .order("created_at", { ascending: false })

  const rows = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    // Fall back to a known role so the UI never crashes on legacy values.
    role: (normaliseRole(p.role) ?? "client") as Role,
    company_name: p.company_name,
    created_at: p.created_at,
  }))

  // Per-role count for the overview strip.
  const roleCounts = rows.reduce<Record<Role, number>>(
    (acc, r) => {
      acc[r.role] = (acc[r.role] ?? 0) + 1
      return acc
    },
    {
      super_admin: 0,
      admin: 0,
      account_executive: 0,
      lead_researcher: 0,
      finance: 0,
      staff: 0,
      client: 0,
    },
  )

  const summaryRoles: Role[] = [
    "super_admin",
    "admin",
    "account_executive",
    "lead_researcher",
    "finance",
    "client",
  ]

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-balance text-foreground">
          {t.admin.users.title}
        </h1>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          {t.admin.users.subtitle}
        </p>
      </div>

      {/* Role overview — compact counts so the operator can see distribution */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryRoles.map((role) => {
          const meta = ROLE_META[role]
          return (
            <Card key={role} className="border-border">
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {locale === "vi" ? meta.labelVi : meta.label}
                </span>
                <span className="text-2xl font-semibold text-foreground">
                  {roleCounts[role]}
                </span>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <UsersTable
            users={rows}
            currentUserId={current.userId}
            currentUserRole={current.role}
            locale={locale}
          />
        </CardContent>
      </Card>
    </div>
  )
}
