"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { siteConfig } from "@/lib/site-config"

export interface CreateProductIntakeLinkResult {
  ok: boolean
  url?: string
  expiresAt?: string
  error?: string
}

/**
 * Generate a public link for supplier to self-fill products.
 * Supplier opens /product-intake/[token] without login, fills products.
 * Link expires in 30 days, can be used multiple times until expiry.
 */
export async function createProductIntakeLink(clientId: string): Promise<CreateProductIntakeLinkResult> {
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, error: "unauthenticated" }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  const allowedRoles = ["admin", "staff", "super_admin", "account_executive", "supplier_researcher"]
  if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
    return { ok: false, error: "forbidden" }
  }

  const admin = createAdminClient()

  // Verify client exists and caller owns it if AE
  const { data: client } = await admin.from("profiles").select("id, company_name").eq("id", clientId).single()
  if (!client) return { ok: false, error: "client_not_found" }

  const token = randomBytes(24).toString("base64url")

  const { data: row, error } = await admin
    .from("product_intake_links")
    .insert({ token, client_id: clientId, created_by: caller.id })
    .select("expires_at")
    .single()

  if (error) {
    // If table doesn't exist yet (migration not run), fallback to informative error
    if (error.message.includes("product_intake_links") || error.code === "42P01") {
      return { ok: false, error: "migration_pending: run 085_product_intake_links.sql" }
    }
    return { ok: false, error: error.message }
  }

  try {
    await admin.from("activities").insert({
      opportunity_id: null,
      action_type: "product_intake_link_created",
      description: JSON.stringify({ client_id: clientId, token_prefix: token.slice(0, 8) }),
      performed_by: caller.id,
    })
  } catch {}

  revalidatePath(`/admin/clients/${clientId}`)

  return {
    ok: true,
    url: `${siteConfig.url}/product-intake/${token}`,
    expiresAt: row?.expires_at,
  }
}

export async function listProductIntakeLinks(clientId: string) {
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) return { ok: false, error: "unauthenticated", data: [] as any[] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("product_intake_links")
    .select("id, token, expires_at, used_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: error.message, data: [] as any[] }

  const siteUrl = siteConfig.url
  const mapped = (data || []).map((r: any) => ({
    ...r,
    url: `${siteUrl}/product-intake/${r.token}`,
  }))

  return { ok: true, data: mapped }
}
