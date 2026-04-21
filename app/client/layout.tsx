import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClientSidebar } from "@/components/client/client-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import type { Profile } from "@/lib/supabase/types"

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: dbProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // SOURCE OF TRUTH for authorization: profiles.role (falls back to
  // user_metadata only if the row is genuinely missing).
  const role = dbProfile?.role ?? (user.user_metadata?.role as string | undefined)

  if (role && ["admin", "staff"].includes(role)) {
    redirect("/admin")
  }

  // Build a safe profile object for the sidebar even if RLS returned null.
  const profile: Profile = dbProfile ?? {
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "",
    role: "client",
    company_name: null,
    industry: null,
    fda_registration_number: null,
    avatar_url: null,
    preferred_language: "vi",
    created_at: new Date().toISOString(),
  }

  return (
    <div className="flex min-h-screen bg-background">
      <ClientSidebar profile={profile} />
      <div className="flex flex-1 flex-col min-w-0">
        <AppTopbar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
