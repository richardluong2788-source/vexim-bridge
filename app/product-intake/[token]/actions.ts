"use server"

import { createAdminClient } from "@/lib/supabase/admin"

interface ProductPayload {
  product_name: string
  product_code?: string
  category: string
  description?: string
  country_of_origin?: string
  unit_of_measure?: string
  currency?: string
  min_unit_price?: number
  max_unit_price?: number
  price_unit?: string
  moq_value?: number
  moq_unit?: string
  lead_time?: string
  incoterm?: string
  hs_code?: string
  key_specifications?: string
  price_confirmed: boolean
  image_urls?: string[]
}

export async function submitProductIntakeAction(token: string, data: ProductPayload) {
  if (!token) return { success: false, error: "invalid_token" }
  if (!data.price_confirmed) return { success: false, error: "price_attestation_required" }

  const admin = createAdminClient()

  const { data: link, error: linkErr } = await admin
    .from("product_intake_links")
    .select("id, client_id, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (linkErr || !link) {
    return { success: false, error: "invalid_or_expired_link" }
  }

  const basePayload: any = {
    client_id: link.client_id,
    product_name: data.product_name,
    product_code: data.product_code || null,
    category: data.category,
    description: data.description || null,
    country_of_origin: data.country_of_origin || "Vietnam",
    unit_of_measure: data.unit_of_measure || "kg",
    currency: data.currency || "USD",
    min_unit_price: data.min_unit_price || null,
    max_unit_price: data.max_unit_price || null,
    price_unit: data.price_unit || null,
    moq_value: data.moq_value || null,
    moq_unit: data.moq_unit || null,
    lead_time: data.lead_time || null,
    incoterm: data.incoterm || null,
    hs_code: data.hs_code || null,
    key_specifications: data.key_specifications || null,
    status: "inactive",
    source_submission_id: null,
    image_urls: data.image_urls || [],
    price_confirmed: true,
    price_attested_at: new Date().toISOString(),
    price_attestation_text:
      "Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.",
    created_by: link.client_id,
  }

  const { error: insertErr } = await admin.from("client_products").insert([basePayload])

  if (insertErr) {
    // Fallback if new columns not migrated yet
    if (insertErr.message.includes("price_confirmed") || insertErr.message.includes("price_attested") || insertErr.message.includes("image_urls")) {
      const fallback: any = { ...basePayload }
      // try without new columns
      delete fallback.price_confirmed
      delete fallback.price_attested_at
      delete fallback.price_attestation_text
      // image_urls exists since 029, but keep fallback
      const { error: retryErr } = await admin.from("client_products").insert([fallback])
      if (retryErr) {
        console.error("[v0] product intake retry failed:", retryErr.message)
        return { success: false, error: retryErr.message }
      }
    } else {
      console.error("[v0] product intake insert failed:", insertErr.message)
      return { success: false, error: insertErr.message }
    }
  }

  await admin.from("product_intake_links").update({ used_at: new Date().toISOString() }).eq("id", link.id)

  try {
    await admin.from("activities").insert({
      action_type: "product_intake_submitted",
      description: JSON.stringify({ client_id: link.client_id, product_name: data.product_name, via_token: token.slice(0, 8), image_count: data.image_urls?.length || 0 }),
      performed_by: link.client_id,
    })
  } catch {}

  return { success: true }
}
