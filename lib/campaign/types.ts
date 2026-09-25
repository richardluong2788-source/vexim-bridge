// Row shapes cho các bảng campaign engine (migration 089/090).
//
// lib/supabase/types.ts là file generate từ Supabase và CHƯA có các bảng mới,
// nên mọi truy vấn dùng shape khai báo tại đây + cast `as any` tại biên giới
// — đúng pattern repo đang dùng cho buyer_engagements (xem
// app/admin/ae-inbox/engagement-actions.ts, webhook resend route).

import type { EnrollmentState } from "./constants"

export interface CampaignRow {
  id: string
  name: string
  description: string | null
  target_segment: string | null
  product_category: string | null
  status: "draft" | "active" | "paused" | "completed" | "archived"
  start_date: string | null
  end_date: string | null
  daily_send_limit: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignStepRow {
  id: string
  campaign_id: string
  step_number: number
  step_type: "initial_outreach" | "follow_up" | "close_loop" | "nurture"
  delay_days: number
  objective: string | null
  ai_prompt_guidance: string | null
  max_attempts: number
  stop_conditions: { stop?: string[] } | null
  created_at: string
}

export interface CampaignEnrollmentRow {
  id: string
  campaign_id: string
  lead_id: string
  state: EnrollmentState
  current_step_number: number
  followup_count: number
  next_action_at: string | null
  next_action_type: string | null
  last_contact_at: string | null
  last_reply_at: string | null
  needs_human_review: boolean
  human_review_reason: string | null
  paused_until: string | null
  handoff_engagement_id: string | null
  stopped_reason: string | null
  owner_id: string | null
  enrolled_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignStepFiringRow {
  id: string
  enrollment_id: string
  step_number: number
  firing_key: string
  status: "claimed" | "draft_created" | "sent" | "failed" | "skipped"
  claimed_at: string
  resolved_at: string | null
  draft_id: string | null
  error: string | null
  created_at: string
}

export interface BuyerInteractionInsert {
  buyer_id: string
  campaign_id?: string | null
  enrollment_id?: string | null
  interaction_type: "EMAIL" | "REPLY" | "CALL" | "NOTE" | "MEETING" | "SYSTEM_EVENT"
  direction: "OUTBOUND" | "INBOUND" | "INTERNAL"
  subject?: string | null
  content?: string | null
  sender?: string | null
  recipient?: string | null
  occurred_at?: string
  sequence_step?: number | null
  ai_generated?: boolean
  human_approved?: boolean
  reply_classification?: Record<string, unknown> | null
  sentiment?: string | null
  intent?: string | null
  metadata?: Record<string, unknown> | null
  draft_id?: string | null
  created_by?: string | null
}

/** BuyerContext (spec §10) — đầu vào DUY NHẤT của AI. */
export interface BuyerContext {
  buyer: {
    company_name: string | null
    country: string | null
    industry: string | null
    website: string | null
    contact_name: string | null
    contact_email: string | null
    contact_title: string | null
  }
  import_data: {
    // Mọi trường không có dữ liệu phải là "UNKNOWN" — KHÔNG được điền bừa.
    hs_codes: string[] | "UNKNOWN"
    main_products: string | "UNKNOWN"
    purchase_history: string | "UNKNOWN"
    vietnam_supplier_exists: string | "UNKNOWN"
    shipment_count: number | "UNKNOWN"
    peak_months: string | "UNKNOWN"
  }
  crm: {
    stage: EnrollmentState
    campaign_step: number
    step_objective: string | null
    followup_count: number
    previous_emails: Array<{
      step: number
      sent_at: string
      subject: string
      content: string
    }>
    replies: Array<{ received_at: string; content: string; intent: string | null }>
  }
  business_rules: {
    max_words: number
    no_links: boolean
    no_attachments: boolean
    opt_out_line_required: boolean
  }
}
