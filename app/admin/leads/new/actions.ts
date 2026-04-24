"use server"

/**
 * Smart client suggestion for lead assignment.
 *
 * Given a buyer's needs (industry, product keyword, required capacity), this
 * action returns a list of Vietnamese exporter clients ranked by how well
 * they can fulfil the order — the inverse of the old "admin picks client
 * from memory" flow.
 *
 * Match level taxonomy (intentionally simple — no % scores):
 *   - best     → exact product match + FDA valid + enough capacity
 *   - possible → same industry OR partial match, minor issues
 *   - override → FDA expired/missing or no relevant products
 *
 * All admin/super_admin users can call this; RLS on the underlying tables
 * handles access control.
 */

import { createClient } from "@/lib/supabase/server"
import { getFdaStatus } from "@/lib/fda/status"
import { normalizeIndustry } from "@/lib/constants/industries"

export type MatchLevel = "best" | "possible" | "override"

export interface MatchReason {
  tone: "positive" | "warning" | "danger"
  text_vi: string
  text_en: string
}

export interface MatchingProduct {
  id: string
  product_name: string
  category: string | null
  subcategory: string | null
  monthly_capacity_units: number | null
  unit_of_measure: string
  min_unit_price: number | null
  max_unit_price: number | null
  currency: string
}

export interface ClientSuggestion {
  client_id: string
  company_name: string | null
  full_name: string | null
  industry: string | null
  industries: string[] | null
  fda_registration_number: string | null
  fda_expires_at: string | null
  fda_status: "missing" | "expired" | "expiring_soon" | "valid"
  fda_days_until_expiry: number | null
  product_count: number
  matching_products: MatchingProduct[]
  level: MatchLevel
  reasons: MatchReason[]
}

export async function suggestClientsForLeadAction(input: {
  industry?: string | null
  productKeyword?: string | null
  capacityNeeded?: number | null
}): Promise<{ success: boolean; data: ClientSuggestion[]; error?: string }> {
  const supabase = await createClient()

  // Caller must be admin/staff/super_admin. RLS would block the profile
  // query for non-admins, but we short-circuit with a friendlier error.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, data: [], error: "Not authenticated" }
  }

  const { data: clients, error: clientsError } = await supabase
    .from("profiles")
    .select(
      "id, full_name, company_name, industry, industries, fda_registration_number, fda_expires_at",
    )
    .eq("role", "client")
    .order("company_name", { ascending: true })

  if (clientsError) {
    console.error("[v0] suggestClientsForLeadAction clients error:", clientsError)
    return { success: false, data: [], error: clientsError.message }
  }
  if (!clients || clients.length === 0) {
    return { success: true, data: [] }
  }

  // Fetch active products for all candidate clients in a single round trip.
  const clientIds = clients.map((c) => c.id)
  const { data: products } = await supabase
    .from("client_products")
    .select(
      "id, client_id, product_name, category, subcategory, monthly_capacity_units, unit_of_measure, min_unit_price, max_unit_price, currency",
    )
    .in("client_id", clientIds)
    .eq("status", "active")

  const productsByClient = new Map<string, MatchingProduct[]>()
  for (const p of products ?? []) {
    const list = productsByClient.get(p.client_id) ?? []
    list.push({
      id: p.id,
      product_name: p.product_name,
      category: p.category,
      subcategory: p.subcategory,
      monthly_capacity_units: p.monthly_capacity_units,
      unit_of_measure: p.unit_of_measure,
      min_unit_price: p.min_unit_price,
      max_unit_price: p.max_unit_price,
      currency: p.currency,
    })
    productsByClient.set(p.client_id, list)
  }

  const normalizedIndustry = normalizeIndustry(input.industry ?? null)
  const keyword = input.productKeyword?.trim().toLowerCase() ?? ""
  const capacity =
    input.capacityNeeded && input.capacityNeeded > 0 ? input.capacityNeeded : null

  const suggestions: ClientSuggestion[] = clients.map((c) => {
    const fdaInfo = getFdaStatus(c.fda_expires_at)
    const clientProducts = productsByClient.get(c.id) ?? []

    // Product keyword match (case-insensitive substring across name/category/subcategory).
    const matchingProducts = keyword
      ? clientProducts.filter((p) => {
          const haystack = [p.product_name, p.category, p.subcategory]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
          return haystack.includes(keyword)
        })
      : clientProducts

    const exactProductMatch =
      keyword.length > 0 &&
      clientProducts.some((p) => p.product_name.toLowerCase().includes(keyword))

    // Industry/category match: check profiles.industries[], profiles.industry, and product categories.
    const clientIndustries = new Set(
      [...(c.industries ?? []), c.industry].filter(Boolean) as string[],
    )
    const productCategories = new Set(
      clientProducts.map((p) => p.category).filter(Boolean) as string[],
    )
    const categoryMatch =
      !!normalizedIndustry &&
      (clientIndustries.has(normalizedIndustry) ||
        productCategories.has(normalizedIndustry))

    // Capacity check — at least ONE matching product must have enough.
    const capacityOk = capacity
      ? matchingProducts.some(
          (p) => (p.monthly_capacity_units ?? 0) >= capacity,
        )
      : true

    const maxCapacityOfMatching =
      matchingProducts.length > 0
        ? matchingProducts.reduce(
            (max, p) => Math.max(max, p.monthly_capacity_units ?? 0),
            0,
          )
        : 0

    // Level derivation (order matters — FDA issues always win).
    let level: MatchLevel
    if (fdaInfo.status === "expired" || fdaInfo.status === "missing") {
      level = "override"
    } else if (exactProductMatch && capacityOk) {
      level = "best"
    } else if (exactProductMatch || categoryMatch) {
      level = "possible"
    } else if (clientProducts.length > 0) {
      // Client has products but none matches the buyer's ask — still possible,
      // admin might know context we don't.
      level = "possible"
    } else {
      // No products at all — cannot responsibly match without an override.
      level = "override"
    }

    // Build the human-readable reasons. Order: product → FDA → capacity.
    const reasons: MatchReason[] = []

    if (exactProductMatch) {
      const count = matchingProducts.length
      reasons.push({
        tone: "positive",
        text_vi:
          count === 1
            ? `Khớp chính xác sản phẩm "${matchingProducts[0].product_name}"`
            : `Có ${count} sản phẩm khớp với từ khóa`,
        text_en:
          count === 1
            ? `Exact product match: "${matchingProducts[0].product_name}"`
            : `${count} products match the keyword`,
      })
    } else if (categoryMatch && normalizedIndustry) {
      reasons.push({
        tone: "positive",
        text_vi: `Cùng ngành hàng (${normalizedIndustry})`,
        text_en: `Same industry (${normalizedIndustry})`,
      })
    } else if (clientProducts.length === 0) {
      reasons.push({
        tone: "warning",
        text_vi: "Chưa đăng ký sản phẩm nào",
        text_en: "No products registered yet",
      })
    } else if (keyword) {
      reasons.push({
        tone: "warning",
        text_vi: `Không có sản phẩm khớp "${input.productKeyword}"`,
        text_en: `No products matching "${input.productKeyword}"`,
      })
    }

    if (fdaInfo.status === "valid") {
      reasons.push({
        tone: "positive",
        text_vi: `FDA còn hạn (${fdaInfo.daysUntilExpiry} ngày)`,
        text_en: `FDA valid (${fdaInfo.daysUntilExpiry} days remaining)`,
      })
    } else if (fdaInfo.status === "expiring_soon") {
      reasons.push({
        tone: "warning",
        text_vi: `FDA sắp hết hạn (còn ${fdaInfo.daysUntilExpiry} ngày)`,
        text_en: `FDA expiring soon (${fdaInfo.daysUntilExpiry} days left)`,
      })
    } else if (fdaInfo.status === "expired") {
      const daysAgo = Math.abs(fdaInfo.daysUntilExpiry ?? 0)
      reasons.push({
        tone: "danger",
        text_vi: `FDA đã hết hạn ${daysAgo} ngày`,
        text_en: `FDA expired ${daysAgo} days ago`,
      })
    } else {
      reasons.push({
        tone: "danger",
        text_vi: "Chưa có đăng ký FDA",
        text_en: "No FDA registration on file",
      })
    }

    if (capacity && matchingProducts.length > 0) {
      const unit = matchingProducts[0].unit_of_measure
      if (capacityOk) {
        reasons.push({
          tone: "positive",
          text_vi: `Đủ công suất ≥ ${capacity} ${unit}/tháng`,
          text_en: `Capacity sufficient (≥ ${capacity} ${unit}/month)`,
        })
      } else {
        reasons.push({
          tone: "warning",
          text_vi: `Công suất tối đa ${maxCapacityOfMatching} ${unit}/tháng (buyer cần ${capacity})`,
          text_en: `Max capacity ${maxCapacityOfMatching} ${unit}/month (buyer needs ${capacity})`,
        })
      }
    }

    return {
      client_id: c.id,
      company_name: c.company_name,
      full_name: c.full_name,
      industry: c.industry,
      industries: c.industries ?? null,
      fda_registration_number: c.fda_registration_number,
      fda_expires_at: c.fda_expires_at,
      fda_status: fdaInfo.status,
      fda_days_until_expiry: fdaInfo.daysUntilExpiry,
      product_count: clientProducts.length,
      matching_products: matchingProducts,
      level,
      reasons,
    }
  })

  // Sort: best → possible → override. Within each band prefer clients with
  // more matching products, then more total products as a tiebreaker.
  const levelOrder: Record<MatchLevel, number> = {
    best: 0,
    possible: 1,
    override: 2,
  }
  suggestions.sort((a, b) => {
    if (levelOrder[a.level] !== levelOrder[b.level]) {
      return levelOrder[a.level] - levelOrder[b.level]
    }
    if (b.matching_products.length !== a.matching_products.length) {
      return b.matching_products.length - a.matching_products.length
    }
    return b.product_count - a.product_count
  })

  return { success: true, data: suggestions }
}
