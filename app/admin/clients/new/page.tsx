import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/server"
import { NewClientForm } from "@/components/admin/new-client-form"
import { IntakeLinkGenerator } from "@/components/admin/intake-link-generator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export default async function NewClientPage() {
  const supabase = await createClient()
  const { locale } = await getDictionary()

  // Server-side guard: admin/staff/super_admin, account_executive and
  // supplier_researcher can access.
  // AEs can create clients and will auto-become their account manager.
  // SRs create unassigned supplier profiles (sourcing-only role).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowedRoles = [
    "admin",
    "staff",
    "super_admin",
    "account_executive",
    "supplier_researcher",
  ]
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect("/client")
  }

  const isAE = profile.role === "account_executive"

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {locale === "vi"
            ? "Thêm khách hàng mới"
            : "Add New Client"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAE
            ? locale === "vi"
              ? "Tạo tài khoản khách hàng mới. Bạn sẽ tự động trở thành Account Manager của họ."
              : "Create a new client account. You will automatically become their Account Manager."
            : locale === "vi"
              ? "Tạo tài khoản cho doanh nghiệp Việt Nam để họ có thể theo dõi pipeline xuất khẩu của mình."
              : "Provision an account for a Vietnamese exporter so they can track their export pipeline."}
        </p>
      </div>

      <Tabs defaultValue="direct" className="mx-auto w-full max-w-2xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="direct">
            {locale === "vi" ? "Tạo trực tiếp" : "Create Directly"}
          </TabsTrigger>
          <TabsTrigger value="link">
            {locale === "vi" ? "Gửi link cho khách hàng" : "Send Client Link"}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="direct" className="mt-6">
          <NewClientForm locale={locale} />
        </TabsContent>
        <TabsContent value="link" className="mt-6">
          <IntakeLinkGenerator locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
