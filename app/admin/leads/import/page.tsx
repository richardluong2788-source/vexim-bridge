import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { BulkLeadImporter } from "@/components/admin/bulk-lead-importer"
import { apolloConfigured } from "@/lib/enrich/apollo"
import { CAPS, can, normaliseRole } from "@/lib/auth/permissions"

/**
 * Sprint D — Bulk lead import with AI matching.
 *
 * SECURITY: Only Lead Researcher + Super Admin are allowed via
 * BUYER_MANUAL_INTAKE. The flow no longer "picks a client" — after
 * uploading buyers, each one is auto-matched to the best AE by the
 * matching pipeline. AEs use the AE Inbox instead.
 */
export default async function BulkImportLeadsPage() {
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t.admin.bulkImport.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 text-pretty max-w-2xl">
          {t.admin.bulkImport.subtitle}
        </p>
      </div>
      <BulkLeadImporter apolloConfigured={apolloConfigured()} />
    </div>
  )
}
