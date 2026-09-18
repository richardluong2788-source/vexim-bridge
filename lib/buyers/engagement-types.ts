// Shared row shapes for the pre-opportunity (engagement) pipeline.
//
// Extracted from app/admin/ae-inbox/engagement-list.tsx so the shared stage
// dialogs (components/admin/engagement-stage-dialogs.tsx) can import them
// without a cycle back into the inbox — the inbox imports those dialogs, so
// the types have to live below both.
//
// Plain types, no "use client": server components read them too.

export type BuyerActionValue =
  | "viewed_only"
  | "interested_no_details"
  | "requested_info"
  | "requested_sample"
  | "requested_meeting"
  | "requested_order_discussion"
  | "selected_primary"
  | "sent_price_volume"
  | "sent_po"

export interface ShortlistItemRow {
  id: string
  client_id: string
  position: number
  match_score: number | null
  buyer_interested: boolean | null
  buyer_action: BuyerActionValue | null
  buyer_responded_at: string | null
  total_dwell_ms: number | null
  first_viewed_at: string | null
  last_dwell_at: string | null
  profiles: { id: string; company_name: string | null; full_name: string | null } | null
}

export interface ShortlistVersionRow {
  id: string
  version_number: number
  status: "draft" | "sent" | "superseded"
  scoring_engine_version: string
  created_at: string
  sent_at: string | null
  superseded_at: string | null
  buyer_engagement_shortlist_items: ShortlistItemRow[]
}

export interface ShareLinkRow {
  token: string
  version_id: string | null
  view_count: number
  last_viewed_at: string | null
  revoked_at: string | null
}

export interface EngagementReplyRow {
  id: string
  from_email: string
  subject: string | null
  raw_content: string
  translated_vi: string | null
  ai_intent: "price_request" | "sample_request" | "objection" | "closing_signal" | "general" | null
  ai_summary: string | null
  ai_suggested_next_step: string | null
  received_at: string
  read_at: string | null
  message_id: string | null
  responded_email_draft_id: string | null
  responded_at: string | null
}

export interface Engagement {
  id: string
  lead_id: string
  account_manager_id: string
  stage: string
  requested_products: string | null
  target_price_range: string | null
  moq: string | null
  payment_terms: string | null
  packaging_requirements: string | null
  other_requirements: string | null
  contact_channel: string | null
  contact_channel_note: string | null
  created_at: string
  updated_at: string
  leads: {
    id: string
    company_name: string
    contact_person: string | null
    contact_email: string | null
    country: string | null
    industry: string | null
    main_product: string | null
    hs_code: string | null
    hs_codes: string[] | null
    product_keywords: string[] | null
  } | null
  buyer_engagement_shortlist_versions: ShortlistVersionRow[]
  shortlist_share_links: ShareLinkRow[]
  buyer_replies?: EngagementReplyRow[]
}

export interface EngagementClient {
  id: string
  full_name: string | null
  company_name: string | null
}
