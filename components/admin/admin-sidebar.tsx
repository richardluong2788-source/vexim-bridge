"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  TrendingUp,
  Users,
  Kanban,
  PlusCircle,
  LogOut,
  BarChart3,
  Activity,
  UserCog,
  Settings,
  Upload,
  Globe2,
  Wallet,
  Briefcase,
  Newspaper,
  type LucideIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Role } from "@/lib/supabase/types"
import { CAPS, can, ROLE_META, type Capability } from "@/lib/auth/permissions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/i18n/language-provider"

interface AdminSidebarProps {
  profile: Profile | null
  /** Normalised role (already validated in admin layout). */
  role: Role
}

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  /** Capability required to see this item. `null` → visible to all admin-shell roles. */
  cap: Capability | null
}

export function AdminSidebar({ profile, role }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t, locale } = useTranslation()

  const fullName = profile?.full_name ?? null
  const email = profile?.email ?? ""

  // Every item is guarded by a capability from lib/auth/permissions.
  // Adding a new admin page means adding a cap here — there is no
  // "everyone sees everything" fallback.
  const allItems: NavItem[] = [
    { href: "/admin",                   label: t.nav.dashboard,                           icon: BarChart3, exact: true, cap: null },
    { href: "/admin/clients",           label: t.nav.clients,                             icon: Users,                  cap: CAPS.CLIENT_VIEW },
    { href: "/admin/pipeline",          label: t.nav.pipeline,                            icon: Kanban,                 cap: CAPS.DEAL_VIEW },
    { href: "/admin/buyers",            label: locale === "vi" ? "Buyer" : "Buyers",      icon: Briefcase,              cap: CAPS.BUYER_VIEW },
    { href: "/admin/leads/new",         label: t.nav.addLead,                             icon: PlusCircle,             cap: CAPS.BUYER_WRITE },
    { href: "/admin/leads/import",      label: t.nav.bulkImport,                          icon: Upload,                 cap: CAPS.BUYER_WRITE },
    { href: "/admin/activities",        label: t.nav.activities,                          icon: Activity,               cap: CAPS.ACTIVITY_LOG_VIEW },
    { href: "/admin/country-risk",      label: t.nav.countryRisk ?? "Country Risk",       icon: Globe2,                 cap: CAPS.COUNTRY_RISK_READ },
    { href: "/admin/finance",           label: t.nav.finance ?? "Tài chính",              icon: Wallet,                 cap: CAPS.FINANCE_READ },
    { href: "/admin/content/posts",     label: locale === "vi" ? "Insights" : "Insights", icon: Newspaper,              cap: CAPS.CONTENT_VIEW },
    { href: "/admin/users",             label: t.nav.users,                               icon: UserCog,                cap: CAPS.USERS_VIEW },
    { href: "/settings/notifications",  label: t.nav_extra.settings,                      icon: Settings,               cap: null },
  ]

  const navItems = allItems.filter((item) => item.cap === null || can(role, item.cap))

  const roleMeta = ROLE_META[role]
  const roleLabel = roleMeta?.labelVi ?? roleMeta?.label ?? role

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground sticky top-0">
      {/* Logo */}
      <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
            <TrendingUp className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold leading-tight truncate">{t.app.name}</span>
            <span className="text-xs text-sidebar-foreground/50 capitalize truncate">
              {t.nav.adminPortal}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
            {(fullName ?? email ?? "A").charAt(0).toUpperCase() || "A"}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">{fullName ?? email}</span>
            <span className="text-[11px] text-sidebar-foreground/50 truncate">{roleLabel}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground px-2"
        >
          <LogOut className="h-4 w-4" />
          {t.common.signOut}
        </Button>
      </div>
    </aside>
  )
}
