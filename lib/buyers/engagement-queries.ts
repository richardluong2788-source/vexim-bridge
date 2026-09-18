// Loading an engagement row — one select, one shape, both surfaces.
//
// The inbox list (the "Đang xử lý" tab of /admin/ae-inbox) and the buyer
// profile's "Phân tích" tab
// (/admin/buyers/[id]) now run the SAME stage dialogs. A dialog reads the
// shortlist versions, the share links and the buyer replies off the engagement
// it is handed, so a row loaded with fewer columns would fail differently on
// each screen — the shortlist builder silent on one, the send dialog empty on
// the other. Both therefore load through here.
//
// Plain module, no "use server": ENGAGEMENT_SELECT is a constant that a
// server-action module cannot export (a "use server" file may only export async
// functions), and the page-level loader is not a client-callable action.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type { Engagement, EngagementClient } from "@/lib/buyers/engagement-types"

/**
 * Every column the stage dialogs and the inbox card need, with the joins that
 * carry them: the buyer (leads), the shortlist versions with their items and the
 * supplier each item points at, the share links, and the replies.
 */
export const ENGAGEMENT_SELECT = `
      id, lead_id, account_manager_id, stage,
      requested_products, target_price_range, moq, payment_terms,
      packaging_requirements, other_requirements,
      contact_channel, contact_channel_note,
      created_at, updated_at,
      leads ( id, company_name, contact_person, contact_email, country, industry, main_product, hs_code, hs_codes, product_keywords ),
      buyer_engagement_shortlist_versions (
        id, version_number, status, scoring_engine_version, created_at, sent_at, superseded_at,
        buyer_engagement_shortlist_items ( id, client_id, position, match_score, buyer_interested, buyer_action, buyer_responded_at,
          total_dwell_ms, first_viewed_at, last_dwell_at,
          profiles:client_id ( id, company_name, full_name ) )
      ),
      shortlist_share_links ( token, version_id, view_count, last_viewed_at, revoked_at ),
      buyer_replies ( id, from_email, subject, raw_content, translated_vi, ai_intent, ai_summary, ai_suggested_next_step, received_at, read_at, message_id, responded_email_draft_id, responded_at )
      `

/** Cookie-bound or service-role client — both are structurally fine for reads. */
type AnyClient = SupabaseClient<Database>

/**
 * The buyer's open engagement (not converted, not dropped), newest first.
 *
 * Returns null when there is none, or when the query fails: this feeds an
 * optional panel, and "no engagement" is a state both callers already render
 * (the profile simply shows no action bar), so a broken read degrades to that
 * rather than taking down the page.
 *
 * NOTE: `buyer_engagements` is missing from lib/supabase/types.ts, so the table
 * name cannot be typed. The cast is confined to this function, and the row is
 * checked into `Engagement` here — the one place that knows the select.
 */
export async function loadOpenEngagementForLead(
  supabase: AnyClient,
  leadId: string,
): Promise<Engagement | null> {
  if (!leadId) return null

  const { data, error } = await (supabase as any)
    .from("buyer_engagements")
    .select(ENGAGEMENT_SELECT)
    .eq("lead_id", leadId)
    .not("stage", "in", "(converted,dropped)")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as Engagement
}

/**
 * A client the AE may assign to a buyer. Superset of EngagementClient: the
 * shortlist builder only needs the name, while the assign dialog shows the FDA
 * expiry (which is also what makes a client assignable in the first place).
 */
export interface AssignableClient extends EngagementClient {
  fda_expires_at: string | null
}

/**
 * The clients an AE may put on a shortlist: active client profiles, optionally
 * scoped to one AE's book.
 *
 * A client whose FDA registration has lapsed is filtered out — the shortlist
 * builder must not be able to offer a supplier the buyer cannot legally import
 * from. Kept here (rather than in each page) so the inbox and the buyer profile
 * cannot disagree about who is assignable.
 */
export async function loadAssignableClients(
  supabase: AnyClient,
  opts: { accountManagerId?: string | null } = {},
): Promise<AssignableClient[]> {
  let query = (supabase as any)
    .from("profiles")
    .select("id, full_name, company_name, fda_expires_at")
    .eq("role", "client")
    .order("company_name")

  if (opts.accountManagerId) {
    query = query.eq("account_manager_id", opts.accountManagerId)
  }

  const { data } = await query
  const now = Date.now()

  return ((data ?? []) as Array<{
    id: string
    full_name: string | null
    company_name: string | null
    fda_expires_at: string | null
  }>)
    .filter((c) => !!c.fda_expires_at && new Date(c.fda_expires_at).getTime() > now)
    .map(({ id, full_name, company_name, fda_expires_at }) => ({
      id,
      full_name,
      company_name,
      fda_expires_at,
    }))
}
