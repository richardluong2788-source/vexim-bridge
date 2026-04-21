import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { landingPathForRole, normaliseRole } from "@/lib/auth/permissions"

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // SECURITY: DB is the source of truth for role. user_metadata can be
  // spoofed / missing. Default to the least-privileged portal (/client)
  // when role cannot be resolved (handled inside landingPathForRole).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  redirect(landingPathForRole(normaliseRole(profile?.role)))
}
