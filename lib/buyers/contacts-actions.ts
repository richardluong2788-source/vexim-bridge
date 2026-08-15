"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { BuyerContact } from "@/lib/supabase/types"

const ALLOWED_ROLES = ["admin", "super_admin", "staff", "account_executive", "lead_researcher"]

async function requireInternalUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" as const }

  const { data: userProfileRaw } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const userProfile = userProfileRaw as { role: string } | null

  if (!userProfile || !ALLOWED_ROLES.includes(userProfile.role)) {
    return { error: "Unauthorized" as const }
  }
  return { user }
}

/** Dong bo leads.contact_* theo lien he primary hien tai cua lead. */
async function syncPrimaryToLead(leadId: string) {
  const admin = createAdminClient()
  const { data: primaryRaw } = await admin
    .from("buyer_contacts")
    .select("full_name, title, email, phone")
    .eq("lead_id", leadId)
    .eq("is_primary", true)
    .maybeSingle()
  const primary = primaryRaw as { full_name: string; title: string | null; email: string | null; phone: string | null } | null

  await (admin.from("leads") as any)
    .update({
      contact_person: primary?.full_name ?? null,
      contact_title: primary?.title ?? null,
      contact_email: primary?.email ?? null,
      contact_phone: primary?.phone ?? null,
    })
    .eq("id", leadId)
}

export async function listContacts(
  leadId: string
): Promise<{ success: boolean; data?: BuyerContact[]; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("buyer_contacts")
    .select("*")
    .eq("lead_id", leadId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as BuyerContact[] }
}

/**
 * Lay danh ba lien he cua buyer gan voi mot opportunity (tra ve ca leadId
 * de UI co the goi cac action khac nhu setPrimary/referToNewContact).
 *
 * Cac lead cu (tao truoc khi co bang buyer_contacts) chi co
 * leads.contact_email/contact_person, chua duoc backfill vao
 * buyer_contacts. Neu khong co dong nao active, ta tong hop mot lien he
 * "primary" ao tu chinh cac cot nay de UI (auto-fill nguoi nhan, CC) van
 * hoat dong thay vi tra ve danh sach rong.
 */
export async function listContactsByOpportunity(
  opportunityId: string
): Promise<{ success: boolean; data?: BuyerContact[]; leadId?: string; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: oppRaw, error: oppError } = await admin
    .from("opportunities")
    .select("lead_id")
    .eq("id", opportunityId)
    .maybeSingle()
  const opp = oppRaw as { lead_id: string | null } | null

  if (oppError) return { success: false, error: oppError.message }
  if (!opp?.lead_id) return { success: true, data: [], leadId: undefined }

  const { data, error } = await admin
    .from("buyer_contacts")
    .select("*")
    .eq("lead_id", opp.lead_id)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) return { success: false, error: error.message }

  if (data && data.length > 0) {
    return { success: true, data: data as BuyerContact[], leadId: opp.lead_id }
  }

  // Chua co danh ba - fallback ve contact_* tren lead
  const { data: leadRaw } = await admin
    .from("leads")
    .select("contact_person, contact_email, contact_phone, contact_title")
    .eq("id", opp.lead_id)
    .maybeSingle()
  const lead = leadRaw as {
    contact_person: string | null
    contact_email: string | null
    contact_phone: string | null
    contact_title: string | null
  } | null

  if (!lead?.contact_email) {
    return { success: true, data: [], leadId: opp.lead_id }
  }

  const virtualContact: BuyerContact = {
    id: `virtual-${opp.lead_id}`,
    lead_id: opp.lead_id,
    full_name: lead.contact_person ?? "Liên hệ chính",
    title: lead.contact_title,
    email: lead.contact_email,
    phone: lead.contact_phone,
    department: null,
    market_region: null,
    is_primary: true,
    is_decision_maker: false,
    status: "active",
    referred_by_contact_id: null,
    notes: null,
    created_by: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  }

  return { success: true, data: [virtualContact], leadId: opp.lead_id }
}

export interface ContactInput {
  full_name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  department?: string | null
  market_region?: string | null
  is_decision_maker?: boolean
  notes?: string | null
}

export async function createContact(
  leadId: string,
  input: ContactInput,
  makePrimary = false
): Promise<{ success: boolean; data?: BuyerContact; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()

  // Neu day la lien he dau tien cua lead, tu dong lam primary
  const { count } = await admin
    .from("buyer_contacts")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
  const shouldBePrimary = makePrimary || (count ?? 0) === 0

  if (shouldBePrimary) {
    await (admin.from("buyer_contacts") as any).update({ is_primary: false }).eq("lead_id", leadId)
  }

  const { data, error } = await (admin.from("buyer_contacts") as any)
    .insert({
      lead_id: leadId,
      full_name: input.full_name,
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      department: input.department ?? null,
      market_region: input.market_region ?? null,
      is_primary: shouldBePrimary,
      is_decision_maker: input.is_decision_maker ?? false,
      notes: input.notes ?? null,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  if (shouldBePrimary) await syncPrimaryToLead(leadId)

  revalidatePath(`/admin/buyers/${leadId}`)
  return { success: true, data: data as BuyerContact }
}

export async function updateContact(
  contactId: string,
  leadId: string,
  input: Partial<ContactInput>
): Promise<{ success: boolean; data?: BuyerContact; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data, error } = await (admin.from("buyer_contacts") as any)
    .update(input)
    .eq("id", contactId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  const { data: isPrimaryRaw } = await admin.from("buyer_contacts").select("is_primary").eq("id", contactId).single()
  if ((isPrimaryRaw as { is_primary: boolean } | null)?.is_primary) {
    await syncPrimaryToLead(leadId)
  }

  revalidatePath(`/admin/buyers/${leadId}`)
  return { success: true, data: data as BuyerContact }
}

export async function deleteContact(
  contactId: string,
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin.from("buyer_contacts").delete().eq("id", contactId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/admin/buyers/${leadId}`)
  return { success: true }
}

export async function setPrimaryContact(
  contactId: string,
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()
  await (admin.from("buyer_contacts") as any).update({ is_primary: false }).eq("lead_id", leadId)
  const { error } = await (admin.from("buyer_contacts") as any)
    .update({ is_primary: true })
    .eq("id", contactId)

  if (error) return { success: false, error: error.message }
  await syncPrimaryToLead(leadId)

  revalidatePath(`/admin/buyers/${leadId}`)
  return { success: true }
}

/**
 * Buyer gioi thieu sang nguoi/email khac: tao lien he moi voi
 * referred_by_contact_id, danh dau lien he cu la 'moved', va dat
 * lien he moi thanh primary + decision maker (mac dinh).
 */
export async function referToNewContact(
  fromContactId: string,
  leadId: string,
  newContact: ContactInput
): Promise<{ success: boolean; data?: BuyerContact; error?: string }> {
  const auth = await requireInternalUser()
  if ("error" in auth) return { success: false, error: auth.error }

  const admin = createAdminClient()

  await (admin.from("buyer_contacts") as any)
    .update({ status: "moved", is_primary: false })
    .eq("id", fromContactId)

  const { data, error } = await (admin.from("buyer_contacts") as any)
    .insert({
      lead_id: leadId,
      full_name: newContact.full_name,
      title: newContact.title ?? null,
      email: newContact.email ?? null,
      phone: newContact.phone ?? null,
      department: newContact.department ?? null,
      market_region: newContact.market_region ?? null,
      is_primary: true,
      is_decision_maker: newContact.is_decision_maker ?? true,
      status: "active",
      referred_by_contact_id: fromContactId,
      notes: newContact.notes ?? null,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  await syncPrimaryToLead(leadId)

  revalidatePath(`/admin/buyers/${leadId}`)
  return { success: true, data: data as BuyerContact }
}
