"use server"

/**
 * Server actions for Commercial Intelligence
 * Allows Lead Researcher and Account Executive to manage CI data
 */

import { createServerClient } from "@/lib/supabase/server"
import type { CommercialIntelligence } from "@/lib/supabase/types"

export async function getCIByOpportunityId(
  opportunityId: string
): Promise<{ ok: true; ci: CommercialIntelligence | null } | { ok: false; error: string }> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from("commercial_intelligence")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()

    if (error) throw error

    return { ok: true, ci: data }
  } catch (err) {
    console.error("[CI] Error fetching CI:", err)
    return { ok: false, error: "fetch_failed" }
  }
}

export async function createOrUpdateCI({
  opportunityId,
  main_hs_code,
  import_history_summary,
  main_competitors,
}: {
  opportunityId: string
  main_hs_code: string | null
  import_history_summary: string | null
  main_competitors: string | null
}): Promise<
  { ok: true; ci: CommercialIntelligence }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createServerClient()
    const { data: user } = await supabase.auth.getUser()

    if (!user?.user) {
      return { ok: false, error: "unauthorized" }
    }

    // Try to get existing CI record
    const { data: existing } = await supabase
      .from("commercial_intelligence")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()

    if (existing) {
      // UPDATE
      const { data, error } = await supabase
        .from("commercial_intelligence")
        .update({
          main_hs_code,
          import_history_summary,
          main_competitors,
          updated_by: user.user.id,
        })
        .eq("opportunity_id", opportunityId)
        .select()
        .single()

      if (error) throw error
      return { ok: true, ci: data }
    } else {
      // INSERT
      const { data, error } = await supabase
        .from("commercial_intelligence")
        .insert({
          opportunity_id: opportunityId,
          main_hs_code,
          import_history_summary,
          main_competitors,
          created_by: user.user.id,
        })
        .select()
        .single()

      if (error) throw error
      return { ok: true, ci: data }
    }
  } catch (err) {
    console.error("[CI] Error saving CI:", err)
    return { ok: false, error: "save_failed" }
  }
}
