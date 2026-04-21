import { createClient } from "@/lib/supabase/server"
import { AddLeadForm } from "@/components/admin/add-lead-form"
import { getDictionary } from "@/lib/i18n/server"

export default async function AddLeadPage() {
  const supabase = await createClient()
  const { t } = await getDictionary()

  // Fetch all clients — only compliant ones can receive leads
  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, industry, fda_registration_number, fda_expires_at")
    .eq("role", "client")
    .order("company_name", { ascending: true })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.admin.addLead.title}</h1>
        <p className="text-sm text-muted-foreground mt-1 text-pretty">{t.admin.addLead.subtitle}</p>
      </div>
      <AddLeadForm clients={clients ?? []} />
    </div>
  )
}
