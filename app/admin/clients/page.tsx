import Link from "next/link"
import { UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ClientsTable } from "@/components/admin/clients-table"
import { getDictionary } from "@/lib/i18n/server"
import { Button } from "@/components/ui/button"

export default async function AdminClientsPage() {
  const supabase = await createClient()
  const { t, locale } = await getDictionary()

  const { data: clients } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.admin.clients.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.admin.clients.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/admin/clients/new">
            <UserPlus className="mr-2 h-4 w-4" />
            {locale === "vi" ? "Thêm khách hàng" : "New Client"}
          </Link>
        </Button>
      </div>
      <ClientsTable clients={clients ?? []} />
    </div>
  )
}
