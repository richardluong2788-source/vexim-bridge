import { redirect } from "next/navigation"
import { SmartLeadForm } from "@/components/admin/smart-lead-form"
import { getDictionary } from "@/lib/i18n/server"
import { createClient } from "@/lib/supabase/server"
import { CAPS, can, normaliseRole } from "@/lib/auth/permissions"

export default async function AddLeadPage() {
  // SECURITY: this is the legacy manual buyer-intake flow that lets the
  // user assign a buyer DIRECTLY to a client, bypassing AI matching.
  // Only Lead Researcher + Super Admin are allowed in. AEs must go
  // through /admin/ae-inbox (AI auto-assign).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = normaliseRole(profile?.role)
  if (!can(role, CAPS.BUYER_MANUAL_INTAKE)) {
    redirect("/admin/ae-inbox")
  }

  const { t } = await getDictionary()

  // Client list is no longer pre-fetched — the smart form loads ranked
  // suggestions on demand via the suggestClientsForLeadAction server action.
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t.admin.addLead.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 text-pretty">
          {t.admin.addLead.subtitle}
        </p>
      </div>
      <SmartLeadForm />
    </div>
  )
}
