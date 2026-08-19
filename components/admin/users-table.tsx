"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/components/i18n/language-provider"
import { updateUserRole } from "@/app/admin/users/actions"
import { ROLE_META, assignableRoles } from "@/lib/auth/permissions"
import type { Role } from "@/lib/supabase/types"
import type { Locale } from "@/lib/i18n/config"

interface UserRow {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  company_name: string | null
  created_at: string
}

interface UsersTableProps {
  users: UserRow[]
  currentUserId: string | null
  currentUserRole: Role | null
  locale: Locale
}

// Role → visual style. Using only theme tokens, no ad-hoc colors.
const ROLE_BADGE_CLASS: Record<Role, string> = {
  super_admin:       "bg-primary text-primary-foreground",
  admin:             "bg-primary/80 text-primary-foreground",
  account_executive: "bg-accent text-accent-foreground",
  lead_researcher:   "bg-secondary text-secondary-foreground",
  finance:           "bg-muted text-foreground border border-border",
  staff:             "bg-muted text-muted-foreground border border-dashed border-border",
  client:            "bg-secondary/60 text-secondary-foreground",
}

export function UsersTable({
  users,
  currentUserId,
  currentUserRole,
  locale,
}: UsersTableProps) {
  const { t } = useTranslation()
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filterRole, setFilterRole] = useState<Role | "all">("all")

  const assignable = useMemo(() => assignableRoles(currentUserRole), [currentUserRole])

  const roleLabel = (role: Role) =>
    locale === "vi" ? ROLE_META[role].labelVi : ROLE_META[role].label

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (filterRole !== "all" && u.role !== filterRole) return false
      if (!q) return true
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.company_name ?? "").toLowerCase().includes(q)
      )
    })
  }, [users, query, filterRole])

  if (users.length === 0) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t.admin.users.empty}</EmptyTitle>
            <EmptyDescription>{t.admin.users.emptyDesc}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  function handleChange(userId: string, nextRole: Role) {
    setPendingId(userId)
    startTransition(async () => {
      const res = await updateUserRole(userId, nextRole)
      setPendingId(null)
      if (res.ok) {
        toast.success(t.admin.users.updated)
      } else if (res.error === "cannotChangeSelf") {
        toast.error(t.admin.users.cannotChangeSelf)
      } else if (res.error === "superAdminOnly") {
        toast.error(t.admin.users.superAdminOnly ?? "Only a super admin can make this change.")
      } else if (res.error === "forbidden") {
        toast.error(t.admin.users.forbidden ?? "You don't have permission to change roles.")
      } else {
        toast.error(t.admin.users.updateFailed, { description: res.error })
      }
    })
  }

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder={t.admin.users.searchPlaceholder ?? "Search by name, email, company..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="md:max-w-xs"
        />
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as Role | "all")}>
          <SelectTrigger className="md:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.users.filterAllRoles ?? "All roles"}</SelectItem>
            {Object.values(ROLE_META)
              .filter((m) => !m.legacy)
              .map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {locale === "vi" ? m.labelVi : m.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3">{t.admin.users.user}</th>
              <th className="px-6 py-3">{t.admin.users.company}</th>
              <th className="px-6 py-3">{t.admin.users.role}</th>
              <th className="px-6 py-3">{t.admin.users.joined}</th>
              <th className="w-56 px-6 py-3">{t.admin.users.changeRole}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => {
              const isSelf = u.id === currentUserId
              const displayName = u.full_name ?? u.email ?? "—"
              const isPending = pending && pendingId === u.id
              const meta = ROLE_META[u.role]
              const isSuperTarget = u.role === "super_admin"
              const callerIsSuper = currentUserRole === "super_admin"
              // Lock the row if the target is super_admin and caller is not.
              const locked = isSelf || (isSuperTarget && !callerIsSuper)

              return (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{displayName}</span>
                      <span className="text-xs text-muted-foreground">{u.email ?? ""}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{u.company_name ?? "—"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <Badge className={ROLE_BADGE_CLASS[u.role]}>{roleLabel(u.role)}</Badge>
                      {meta?.legacy ? (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t.admin.users.legacyRole ?? "legacy"}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                  <td className="px-6 py-4">
                    <Select
                      value={u.role}
                      disabled={locked || isPending}
                      onValueChange={(v) => handleChange(u.id, v as Role)}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignable.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <span className="flex flex-col items-start gap-0.5">
                              <span>{locale === "vi" ? m.labelVi : m.label}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {m.description}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isSelf ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.admin.users.cannotChangeSelf}
                      </p>
                    ) : isSuperTarget && !callerIsSuper ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.admin.users.superAdminLocked ??
                          "Only a super admin can change another super admin."}
                      </p>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">
                  {t.admin.users.noResults ?? "No users match these filters."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
