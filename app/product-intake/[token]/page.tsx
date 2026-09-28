import { TrendingUp } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/admin"
import { siteConfig } from "@/lib/site-config"
import { ProductIntakeForm } from "@/components/product-intake/product-intake-form"

interface ProductIntakeLinkRow {
  id: string
  token: string
  client_id: string
  expires_at: string
  client: { id: string; company_name: string | null; email: string | null } | null
}

export default async function ProductIntakePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  // Validate token
  const { data: link } = await admin
    .from("product_intake_links")
    .select("id, token, client_id, expires_at, client:profiles!product_intake_links_client_id_fkey(id, company_name, email)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  const typedLink = link as unknown as ProductIntakeLinkRow | null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">{siteConfig.name}</span>
            <span className="text-xs text-muted-foreground">{siteConfig.tagline}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {typedLink ? (
          <ProductIntakeForm token={token} clientId={typedLink.client_id} companyName={typedLink.client?.company_name || "Supplier"} />
        ) : (
          <InvalidLinkNotice />
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-6 pb-10 text-center text-xs text-muted-foreground">
        {siteConfig.legalName} · {siteConfig.contact.email}
      </footer>
    </div>
  )
}

function InvalidLinkNotice() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
      <h1 className="text-lg font-semibold text-foreground">Liên kết không hợp lệ hoặc đã hết hạn</h1>
      <p className="text-sm text-muted-foreground">
        Liên kết điền sản phẩm này có thể đã hết hạn hoặc không tồn tại. Vui lòng liên hệ AE đã gửi link để nhận link mới.
      </p>
    </div>
  )
}
