"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type {
  ClientProfile,
  ClientProfileWithRelations,
  CreateClientProfileInput,
  UpdateClientProfileInput,
  ProfileQuoteRequest,
  ComplianceDoc,
  ClientProduct,
} from "@/lib/supabase/types"

// ============================================================
// Public Queries (No Auth Required)
// ============================================================

/**
 * Get a published client profile by slug.
 * Uses admin client to bypass RLS for public read.
 */
export async function getProfileBySlug(
  slug: string
): Promise<{ success: boolean; data?: ClientProfileWithRelations; error?: string }> {
  const supabase = createAdminClient()

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single()

  if (profileError || !profile) {
    return { success: false, error: "Profile not found" }
  }

  // Fetch client info
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profile.client_id)
    .single()

  // Fetch featured certifications
  const featuredCertIds = profile.featured_certifications || []
  let certifications: ComplianceDoc[] = []
  if (featuredCertIds.length > 0) {
    const { data: certs } = await supabase
      .from("compliance_docs")
      .select("*")
      .in("id", featuredCertIds)

    certifications = certs || []
  }

  // Fetch featured products
  const featuredProductIds = profile.featured_products || []
  let products: ClientProduct[] = []
  if (featuredProductIds.length > 0) {
    const { data: prods } = await supabase
      .from("client_products")
      .select("*")
      .in("id", featuredProductIds)
      .eq("status", "active")

    products = prods || []
  }

  // Increment view count (non-blocking)
  supabase
    .from("client_profiles")
    .update({ view_count: (profile.view_count || 0) + 1 })
    .eq("id", profile.id)
    .then(() => {})

  return {
    success: true,
    data: {
      ...profile,
      profiles: clientProfile!,
      certifications,
      products,
    } as ClientProfileWithRelations,
  }
}

// ============================================================
// Admin Queries
// ============================================================

/**
 * Get profile by client ID (for admin management).
 * Returns null if no profile exists yet.
 */
export async function getProfileByClientId(
  clientId: string
): Promise<{ success: boolean; data?: ClientProfile | null; error?: string }> {
  const supabase = await createClient()

  // Verify user is admin/staff
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowedRoles = ["admin", "super_admin", "staff", "account_executive"]
  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    return { success: false, error: "Unauthorized" }
  }

  // Fetch profile using admin client
  const adminSupabase = createAdminClient()
  const { data: profile, error } = await adminSupabase
    .from("client_profiles")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: profile }
}

/**
 * Get profile with relations by client ID (for admin preview).
 */
export async function getProfileWithRelationsByClientId(
  clientId: string
): Promise<{ success: boolean; data?: ClientProfileWithRelations | null; error?: string }> {
  const supabase = await createClient()

  // Verify user is admin/staff
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowedRoles = ["admin", "super_admin", "staff", "account_executive"]
  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    return { success: false, error: "Unauthorized" }
  }

  const adminSupabase = createAdminClient()

  // Fetch profile
  const { data: profile } = await adminSupabase
    .from("client_profiles")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle()

  if (!profile) {
    return { success: true, data: null }
  }

  // Fetch client info
  const { data: clientProfile } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("id", profile.client_id)
    .single()

  // Fetch featured certifications
  const featuredCertIds = profile.featured_certifications || []
  let certifications: ComplianceDoc[] = []
  if (featuredCertIds.length > 0) {
    const { data: certs } = await adminSupabase
      .from("compliance_docs")
      .select("*")
      .in("id", featuredCertIds)

    certifications = certs || []
  }

  // Fetch featured products
  const featuredProductIds = profile.featured_products || []
  let products: ClientProduct[] = []
  if (featuredProductIds.length > 0) {
    const { data: prods } = await adminSupabase
      .from("client_products")
      .select("*")
      .in("id", featuredProductIds)

    products = prods || []
  }

  return {
    success: true,
    data: {
      ...profile,
      profiles: clientProfile!,
      certifications,
      products,
    } as ClientProfileWithRelations,
  }
}

// ============================================================
// Admin Mutations
// ============================================================

/**
 * Create a new client profile.
 */
export async function createClientProfile(
  input: CreateClientProfileInput
): Promise<{ success: boolean; data?: ClientProfile; error?: string }> {
  const supabase = await createClient()

  // Verify user is admin/staff
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowedRoles = ["admin", "super_admin", "staff", "account_executive"]
  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    return { success: false, error: "Unauthorized" }
  }

  const adminSupabase = createAdminClient()

  // Check if slug is unique
  const { data: existingSlug } = await adminSupabase
    .from("client_profiles")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle()

  if (existingSlug) {
    return { success: false, error: "Slug already exists. Please choose a different one." }
  }

  // Check if client already has a profile
  const { data: existingProfile } = await adminSupabase
    .from("client_profiles")
    .select("id")
    .eq("client_id", input.client_id)
    .maybeSingle()

  if (existingProfile) {
    return { success: false, error: "Client already has a profile" }
  }

  // Create profile
  const { data: profile, error } = await adminSupabase
    .from("client_profiles")
    .insert({
      client_id: input.client_id,
      slug: input.slug,
      display_name: input.display_name || null,
      tagline: input.tagline || null,
      cover_image_url: input.cover_image_url || null,
      logo_url: input.logo_url || null,
      video_url: input.video_url || null,
      video_thumbnail_url: input.video_thumbnail_url || null,
      usp_points: input.usp_points || [],
      production_capacity: input.production_capacity || null,
      moq: input.moq || null,
      lead_time_days: input.lead_time_days || null,
      featured_certifications: input.featured_certifications || [],
      featured_products: input.featured_products || [],
      enable_request_quote: input.enable_request_quote ?? true,
      enable_download_pdf: input.enable_download_pdf ?? true,
      pdf_capability_url: input.pdf_capability_url || null,
      is_published: false,
      view_count: 0,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] createClientProfile error:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: profile }
}

/**
 * Update an existing client profile.
 */
export async function updateClientProfile(
  profileId: string,
  input: UpdateClientProfileInput
): Promise<{ success: boolean; data?: ClientProfile; error?: string }> {
  const supabase = await createClient()

  // Verify user is admin/staff
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowedRoles = ["admin", "super_admin", "staff", "account_executive"]
  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    return { success: false, error: "Unauthorized" }
  }

  const adminSupabase = createAdminClient()

  // Check if slug is unique (if changing slug)
  if (input.slug) {
    const { data: existingSlug } = await adminSupabase
      .from("client_profiles")
      .select("id")
      .eq("slug", input.slug)
      .neq("id", profileId)
      .maybeSingle()

    if (existingSlug) {
      return { success: false, error: "Slug already exists. Please choose a different one." }
    }
  }

  // Update profile
  const { data: profile, error } = await adminSupabase
    .from("client_profiles")
    .update({
      ...input,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select()
    .single()

  if (error) {
    console.error("[v0] updateClientProfile error:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: profile }
}

/**
 * Publish a client profile.
 */
export async function publishProfile(
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify user is admin/staff
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowedRoles = ["admin", "super_admin", "staff", "account_executive"]
  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    return { success: false, error: "Unauthorized" }
  }

  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from("client_profiles")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)

  if (error) {
    console.error("[v0] publishProfile error:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Unpublish a client profile.
 */
export async function unpublishProfile(
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify user is admin/staff
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowedRoles = ["admin", "super_admin", "staff", "account_executive"]
  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    return { success: false, error: "Unauthorized" }
  }

  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from("client_profiles")
    .update({
      is_published: false,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)

  if (error) {
    console.error("[v0] unpublishProfile error:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ============================================================
// Quote Request (Public)
// ============================================================

/**
 * Submit a quote request from the public profile page.
 * Creates a lead and opportunity in the system.
 */
export async function submitQuoteRequest(
  request: ProfileQuoteRequest
): Promise<{ success: boolean; reference?: string; error?: string }> {
  const adminSupabase = createAdminClient()

  // Get the profile to find the client
  const { data: profile } = await adminSupabase
    .from("client_profiles")
    .select("client_id, display_name")
    .eq("id", request.profile_id)
    .single()

  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  // Get client info
  const { data: client } = await adminSupabase
    .from("profiles")
    .select("account_manager_id")
    .eq("id", profile.client_id)
    .single()

  // Create lead
  const { data: lead, error: leadError } = await adminSupabase
    .from("leads")
    .insert({
      company_name: request.company_name,
      contact_person: request.contact_name,
      contact_email: request.email,
      contact_phone: request.phone || null,
      region: "North America",
      country: "United States",
      source: "profile_page",
      notes: `Quote request from profile page.\n\nProducts interested: ${request.products_interested.join(", ")}\nQuantity/Volume: ${request.quantity_volume || "Not specified"}\n\nNotes: ${request.notes || "None"}`,
    })
    .select()
    .single()

  if (leadError || !lead) {
    console.error("[v0] submitQuoteRequest lead error:", leadError)
    return { success: false, error: "Failed to create lead" }
  }

  // Create opportunity
  const { data: opportunity, error: oppError } = await adminSupabase
    .from("opportunities")
    .insert({
      client_id: profile.client_id,
      lead_id: lead.id,
      stage: "new",
      products_interested: request.products_interested.join(", "),
      quantity_required: request.quantity_volume || null,
      notes: `Inquiry via ${profile.display_name || "Supplier"} profile page`,
    })
    .select()
    .single()

  if (oppError) {
    console.error("[v0] submitQuoteRequest opportunity error:", oppError)
    // Don't fail - lead was still created
  }

  // Create notification for account manager or admins
  const notifyUserId = client?.account_manager_id
  if (notifyUserId) {
    await adminSupabase.from("notifications").insert({
      user_id: notifyUserId,
      category: "new_assignment",
      title: "New Quote Request",
      body: `${request.company_name} requested a quote via profile page`,
      link_path: opportunity ? `/admin/opportunities/${opportunity.id}` : `/admin/leads`,
      opportunity_id: opportunity?.id || null,
    })
  }

  // Generate reference number
  const reference = `QR-${Date.now().toString(36).toUpperCase()}`

  return { success: true, reference }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Generate a URL-safe slug from company name.
 */
export function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

/**
 * Check if a slug is available.
 */
export async function checkSlugAvailability(
  slug: string,
  excludeProfileId?: string
): Promise<{ available: boolean }> {
  const adminSupabase = createAdminClient()

  let query = adminSupabase.from("client_profiles").select("id").eq("slug", slug)

  if (excludeProfileId) {
    query = query.neq("id", excludeProfileId)
  }

  const { data } = await query.maybeSingle()

  return { available: !data }
}
