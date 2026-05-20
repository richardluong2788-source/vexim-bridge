import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/server"
import { ClientDocumentsView } from "@/components/client/documents/client-documents-view"

export default async function ClientDocumentsPage() {
  const supabase = await createClient()
  const { t } = await getDictionary()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch client's compliance documents
  const { data: documents } = await supabase
    .from("compliance_docs")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t.client.documents?.title ?? "My Documents"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.client.documents?.subtitle ?? "Manage your compliance certificates and export documents"}
        </p>
      </div>

      <ClientDocumentsView initialDocuments={documents ?? []} />
    </div>
  )
}
