import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { BulkLeadImporter } from "@/components/admin/bulk-lead-importer"
import { apolloConfigured } from "@/lib/enrich/apollo"

/**
 * Sprint D — Bulk lead import page.
 * Staff paste a tab-separated or CSV block, preview dedup, and commit.
 */
export default async function BulkImportLeadsPage() {
  const supabase = await createClient()
  const { t } = await getDictionary()

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, industry, fda_registration_number")
    .eq("role", "client")
    .order("company_name", { ascending: true })

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
      <BulkLeadImporter
        clients={clients ?? []}
        apolloConfigured={apolloConfigured()}
      />
    </div>
  )
}
