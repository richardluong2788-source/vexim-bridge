"use server"

import { createClient } from "@/lib/supabase/server"
import { INDUSTRIES, type Industry } from "@/lib/constants/industries"

export interface ClientIntakePayload {
  contact_name: string
  email: string
  phone: string
  company_name: string
  industries: Industry[]
  country?: string
  address?: string
  website?: string
  tax_code?: string
  tagline?: string
  company_description?: string
  main_products?: string
  production_capacity?: string
  moq?: string
  lead_time_days?: string
  usp_points?: { icon: string; title: string }[]
  logo_url?: string
  cover_image_url?: string
  factory_image_urls?: string[]
  video_url?: string
  certifications?: string[]
  certifications_other?: string
}

export interface SubmitClientIntakeResult {
  ok: boolean
  error?: string
}

/**
 * Public server action — called from the unauthenticated /client-intake/[token]
 * wizard on final submit. Delegates to the `submit_client_intake` RPC
 * (SECURITY DEFINER) so we never grant a raw anon UPDATE policy on
 * `client_intake_submissions`. Validates the required fields client-facing
 * here as a second line of defense before hitting the DB.
 */
export async function submitClientIntake(
  token: string,
  data: ClientIntakePayload,
): Promise<SubmitClientIntakeResult> {
  const email = data.email?.trim().toLowerCase()
  const contactName = data.contact_name?.trim()
  const company = data.company_name?.trim()
  const phone = data.phone?.trim()

  if (!token) return { ok: false, error: "invalid_token" }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" }
  }
  if (!contactName) return { ok: false, error: "contact_name_required" }
  if (!company) return { ok: false, error: "company_required" }
  if (!phone) return { ok: false, error: "phone_required" }

  const industries = (data.industries ?? []).filter((ind) =>
    (INDUSTRIES as readonly string[]).includes(ind),
  )
  if (industries.length === 0) return { ok: false, error: "industry_invalid" }

  const supabase = await createClient()

  const { data: success, error } = await supabase.rpc("submit_client_intake", {
    p_token: token,
    p_payload: {
      contact_name: contactName,
      email,
      phone,
      company_name: company,
      industries,
      country: data.country?.trim() || null,
      address: data.address?.trim() || null,
      website: data.website?.trim() || null,
      tax_code: data.tax_code?.trim() || null,
      tagline: data.tagline?.trim() || null,
      company_description: data.company_description?.trim() || null,
      main_products: data.main_products?.trim() || null,
      production_capacity: data.production_capacity?.trim() || null,
      moq: data.moq?.trim() || null,
      lead_time_days: data.lead_time_days?.trim() || null,
      usp_points: data.usp_points ?? [],
      logo_url: data.logo_url?.trim() || null,
      cover_image_url: data.cover_image_url?.trim() || null,
      factory_image_urls: data.factory_image_urls ?? [],
      video_url: data.video_url?.trim() || null,
      certifications: data.certifications ?? [],
      certifications_other: data.certifications_other?.trim() || null,
    },
  })

  if (error) {
    console.error("[v0] submit_client_intake RPC error:", error.message)
    return { ok: false, error: "submit_failed" }
  }
  if (!success) {
    return { ok: false, error: "link_expired" }
  }

  return { ok: true }
}
