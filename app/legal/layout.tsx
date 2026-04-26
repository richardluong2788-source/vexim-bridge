import type { ReactNode } from "react"
import { LandingHeader } from "@/components/landing/landing-header"
import { LandingFooter } from "@/components/landing/landing-footer"
import { createClient } from "@/lib/supabase/server"
import { landingPathForRole, normaliseRole } from "@/lib/auth/permissions"

/**
 * Shared shell for /legal/* pages. Reuses the marketing header and footer so
 * legal documents inherit the same brand chrome while staying fully indexable
 * for search engines (no auth gating, no noindex).
 *
 * The layout figures out the correct dashboard CTA target based on the
 * visitor's role — visitors who happen to be logged in still see the legal
 * docs (they need to read them), but the header CTA points to their portal.
 */
export default async function LegalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let dashboardHref = "/auth/login"
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    dashboardHref = landingPathForRole(normaliseRole(profile?.role))
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader isAuthed={!!user} dashboardHref={dashboardHref} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <LandingFooter />
    </div>
  )
}
