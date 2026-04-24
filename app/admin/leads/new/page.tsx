import { SmartLeadForm } from "@/components/admin/smart-lead-form"
import { getDictionary } from "@/lib/i18n/server"

export default async function AddLeadPage() {
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
