"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/supabase/types"
import {
  TrendingUp,
  LayoutDashboard,
  List,
  LogOut,
  Settings,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/i18n/language-provider"

interface ClientSidebarProps {
  profile: Profile | null
}

export function ClientSidebar({ profile }: ClientSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()

  // Defensive: always have a safe object even if parent passes null.
  const companyName = profile?.company_name ?? null
  const fullName = profile?.full_name ?? null
  const email = profile?.email ?? ""

  const navItems = [
    { href: "/client", label: t.nav.dashboard, icon: LayoutDashboard, exact: true },
    { href: "/client/leads", label: t.nav.leads, icon: List },
    { href: "/client/analytics", label: t.client.analytics.navLabel, icon: BarChart3 },
    { href: "/settings/notifications", label: t.nav_extra.settings, icon: Settings },
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
          <TrendingUp className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold leading-tight truncate">{t.app.name}</span>
          <span className="text-xs text-sidebar-foreground/50 truncate">
            {companyName ?? t.nav.clientPortal}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
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
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold shrink-0">
            {(companyName ?? fullName ?? email ?? "C").charAt(0).toUpperCase() || "C"}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">
              {companyName ?? fullName ?? email}
            </span>
            <span className="text-xs text-sidebar-foreground/50 truncate">{email}</span>
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
