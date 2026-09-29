"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { translateSupplierTextFields } from "@/lib/ai/supplier-content-translation"
import { notifyAeAndSrOfProductIntake } from "@/lib/notifications/product-intake-submitted"

const STANDARD_CATEGORY_VALUES = new Set([
  "Coffee",
  "Cocoa",
  "Pepper",
  "Cashew",
  "Spices",
  "Nuts",
  "Dried Fruits",
  "Grains",
  "Oils",
  "Seafood",
  "Other",
])

interface ProductPayload {
  product_name: string
  product_code?: string
  category: string
  subcategory?: string
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
  incoterm_place?: string
  payment_terms?: string
  hs_code?: string
  key_specifications?: string
  usp?: string
  monthly_capacity_units?: number
  packing?: string
  package_size?: string
  shelf_life?: string
  storage_conditions?: string
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

  // product_intake_links is not yet represented in the generated Supabase type.
  const clientId = link.client_id as string
  const intakeLinkId = link.id as string

  const productName = data.product_name?.trim()
  const category = data.category?.trim()
  if (!productName || !category) {
    return { success: false, error: "Vui lòng điền tên sản phẩm và danh mục." }
  }

  // Make sure the private provenance table is installed before a submission can
  // be translated; otherwise a successful RPC could lose the source text.
  const { error: provenanceCheckError } = await admin
    .from("client_product_intake_sources")
    .select("product_id")
    .limit(0)
  if (provenanceCheckError) {
    console.error("[product intake] provenance migration is unavailable:", provenanceCheckError.message)
    return { success: false, error: "Hệ thống đang được cập nhật. Vui lòng thử lại sau hoặc liên hệ AE." }
  }

  // Canonical category values are codes and must not be rewritten. A supplier-
  // entered custom category is free text, so translate it with the descriptions.
  const isStandardCategory = STANDARD_CATEGORY_VALUES.has(category)
  const textFields: Record<string, string | undefined> = {
    product_name: productName,
    subcategory: data.subcategory,
    description: data.description,
    country_of_origin: data.country_of_origin,
    price_unit: data.price_unit,
    moq_unit: data.moq_unit,
    lead_time: data.lead_time,
    incoterm_place: data.incoterm_place,
    key_specifications: data.key_specifications,
    usp: data.usp,
    packing: data.packing,
    package_size: data.package_size,
    shelf_life: data.shelf_life,
    storage_conditions: data.storage_conditions,
  }
  if (!isStandardCategory) textFields.category = category

  const translation = await translateSupplierTextFields(textFields)
  const translatedValue = (key: string, value?: string) =>
    translation.translatedTexts[key] ?? value?.trim() ?? null
  const translatedProductName = translatedValue("product_name", productName) ?? productName
  const basePayload: any = {
    client_id: clientId,
    product_name: translatedProductName,
    product_code: data.product_code?.trim() || null,
    category: translatedValue("category", category) ?? category,
    subcategory: translatedValue("subcategory", data.subcategory),
    description: translatedValue("description", data.description),
    country_of_origin: translatedValue("country_of_origin", data.country_of_origin) || "Vietnam",
    unit_of_measure: data.unit_of_measure || "kg",
    currency: data.currency || "USD",
    min_unit_price: data.min_unit_price || null,
    max_unit_price: data.max_unit_price || null,
    price_unit: translatedValue("price_unit", data.price_unit),
    moq_value: data.moq_value || null,
    moq_unit: translatedValue("moq_unit", data.moq_unit),
    lead_time: translatedValue("lead_time", data.lead_time),
    incoterm: data.incoterm || null,
    incoterm_place: translatedValue("incoterm_place", data.incoterm_place),
    payment_terms: data.payment_terms || null,
    hs_code: data.hs_code?.trim() || null,
    key_specifications: translatedValue("key_specifications", data.key_specifications),
    usp: translatedValue("usp", data.usp),
    monthly_capacity_units: data.monthly_capacity_units || null,
    packing: translatedValue("packing", data.packing),
    package_size: translatedValue("package_size", data.package_size),
    shelf_life: translatedValue("shelf_life", data.shelf_life),
    storage_conditions: translatedValue("storage_conditions", data.storage_conditions),
    status: "inactive",
    source_submission_id: null,
    image_urls: data.image_urls || [],
    price_confirmed: true,
    price_attested_at: new Date().toISOString(),
    price_attestation_text:
      "Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.",
    created_by: clientId,
    // Lets the admin UI show "N sản phẩm" per link instead of a vague
    // "đã dùng" flag. Migration 089; stripped below if not applied yet.
    product_intake_link_id: intakeLinkId,
  }

  // Returns the new row's id, or an error the supplier can act on.
  // `.select("id")` is required so the notification dedup key can name this
  // exact row; a timestamp would make every key unique and defeat dedup.
  const result = await insertProduct(admin, basePayload, data.product_code)
  if (result.error) return { success: false, error: result.error }
  if (!result.id) return { success: false, error: "Gửi thất bại. Vui lòng thử lại." }
  const productId = result.id

  // Keep originals in a private table: client_products is readable by public
  // catalog visitors when active, and must contain only the English version.
  const { error: sourceError } = await admin
    .from("client_product_intake_sources")
    .insert({
      product_id: productId,
      client_id: clientId,
      source_texts: translation.sourceTexts,
      source_language: translation.sourceLanguage,
      translation_status: translation.status,
    })
  if (sourceError) {
    // Roll back the product so the supplier can retry without hitting the unique
    // SKU constraint; never report success if the source text was not retained.
    console.error("[product intake] original text metadata save failed:", sourceError.message)
    const { error: rollbackError } = await admin.from("client_products").delete().eq("id", productId)
    if (rollbackError) {
      console.error("[product intake] product rollback after provenance failure failed:", rollbackError.message)
    }
    return { success: false, error: "Không lưu được nội dung gốc. Vui lòng thử gửi lại hoặc liên hệ AE." }
  }

  await admin.from("product_intake_links").update({ used_at: new Date().toISOString() }).eq("id", intakeLinkId)

  try {
    await admin.from("activities").insert({
      action_type: "product_intake_submitted",
      description: JSON.stringify({ client_id: clientId, product_name: translatedProductName, via_token: token.slice(0, 8), image_count: data.image_urls?.length || 0 }),
      performed_by: clientId,
    })
  } catch {}

  // Best-effort notify AE/SR via system + email to registration email.
  notifyAeAndSrOfProductIntake(token, translatedProductName, productId).catch((err) => {
    console.error("[product intake] notify failed", err)
  })

  return { success: true, productId, translationStatus: translation.status }
}

/**
 * Insert one product, returning its id.
 *
 * `client_products` carries UNIQUE(client_id, product_code) - one SKU per
 * client. Submitting several products is the whole point of this form, so a
 * supplier reusing a code is an expected path, not an edge case. Supabase
 * hands back the raw Postgres text ("duplicate key value violates unique
 * constraint ..."), which must never reach a supplier-facing toast, so it is
 * translated here.
 */
async function insertProduct(
  admin: ReturnType<typeof createAdminClient>,
  payload: any,
  productCode?: string,
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await admin
    .from("client_products")
    .insert([payload])
    .select("id")
    .single()

  if (!error) return { id: (data as { id: string }).id }

  // 23505 = unique_violation.
  if (error.code === "23505" || /duplicate key|already exists/i.test(error.message)) {
    console.warn("[product intake] duplicate SKU rejected:", productCode, "-", error.message)
    return {
      error: productCode
        ? `Mã SKU "${productCode}" đã được dùng cho một sản phẩm khác của công ty. Vui lòng để trống hoặc dùng mã khác.`
        : "Sản phẩm này đã tồn tại trong danh mục. Vui lòng kiểm tra lại thông tin.",
    }
  }

  // Fallback for missing columns (if migration 088/089 not yet applied).
  const missingCol =
    error.message.includes("column") ||
    error.message.includes("does not exist") ||
    error.message.includes("product_intake_link_id")
  if (missingCol) {
    const fallback: any = { ...payload }
    const tryCols = [
      "product_intake_link_id",
      "price_confirmed",
      "price_attested_at",
      "price_attestation_text",
      "packing",
      "package_size",
      "shelf_life",
      "storage_conditions",
      "usp",
      "payment_terms",
      "incoterm_place",
      "monthly_capacity_units",
      "price_unit",
      "subcategory",
    ]
    for (const col of tryCols) {
      if (error.message.includes(col)) delete fallback[col]
    }
    const retry = await admin.from("client_products").insert([fallback]).select("id").single()
    if (!retry.error) return { id: (retry.data as { id: string }).id }
    console.error("[v0] product intake retry failed:", retry.error.message)
    return { error: "Gửi thất bại. Vui lòng thử lại." }
  }

  console.error("[v0] product intake insert failed:", error.message)
  return { error: "Gửi thất bại. Vui lòng thử lại." }
}
