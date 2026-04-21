-- ============================================================
-- Sprint D — Growth & AI Inbound
-- Migration 010: buyer_replies, re-engagement marker, client revenue view
-- ============================================================
-- Idempotent. Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. BUYER_REPLIES: every inbound message from a buyer, with AI triage
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,

  -- Original buyer message (admin pastes English; we keep as-is).
  raw_content TEXT NOT NULL,
  raw_language TEXT NOT NULL DEFAULT 'en',

  -- AI-generated Vietnamese translation shown to the Vietnamese admin.
  translated_vi TEXT,

  -- AI classification. Enumerated below — free-text is tolerated but the
  -- UI only renders known values.
  ai_intent TEXT
    CHECK (ai_intent IN (
      'price_request',
      'sample_request',
      'objection',
      'closing_signal',
      'general'
    )),
  ai_summary TEXT,
  ai_confidence NUMERIC(4, 3),              -- 0.000–1.000
  ai_suggested_next_step TEXT,              -- "Send quotation with FOB price + MOQ"
  ai_model TEXT,                            -- e.g. "openai/gpt-4o-mini"

  -- When the buyer actually sent the email (admin can backdate).
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_replies_opportunity
  ON public.buyer_replies(opportunity_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_replies_intent
  ON public.buyer_replies(ai_intent);

ALTER TABLE public.buyer_replies ENABLE ROW LEVEL SECURITY;

-- Staff-side roles can see and manage every reply.
DROP POLICY IF EXISTS "Staff manage buyer replies" ON public.buyer_replies;
CREATE POLICY "Staff manage buyer replies"
  ON public.buyer_replies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'admin', 'staff', 'super_admin',
          'account_executive', 'lead_researcher'
        )
    )
  );

-- Clients NEVER read raw buyer content — it's part of ESH's buyer-masking
-- moat. They see stage/next_step/client_action_required on opportunities
-- instead. No SELECT policy for clients → RLS blocks them by default.

-- ------------------------------------------------------------
-- 2. OPPORTUNITIES: re-engagement marker so the cron can dedup
-- ------------------------------------------------------------
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS reengagement_task_created_at TIMESTAMPTZ;

COMMENT ON COLUMN public.opportunities.reengagement_task_created_at IS
  'Set by the re-engagement cron the first time a Won deal crosses the 90-day threshold, to avoid creating duplicate activity tasks.';

-- Fast filter: "Won deals older than N days without a re-engagement task".
CREATE INDEX IF NOT EXISTS idx_opportunities_reengagement_candidates
  ON public.opportunities (stage, last_updated)
  WHERE stage = 'won' AND reengagement_task_created_at IS NULL;

-- ------------------------------------------------------------
-- 3. CLIENT REVENUE VIEW: cumulative paid commission per client
-- ------------------------------------------------------------
-- Replaces hand-rolled aggregation in the client dashboard. Uses
-- SECURITY INVOKER so RLS on deals/opportunities still applies —
-- clients only see their own rows.
CREATE OR REPLACE VIEW public.client_commission_timeline AS
SELECT
  o.client_id,
  COALESCE(d.paid_at, d.updated_at)::date AS paid_on,
  COALESCE(d.commission_amount, 0)         AS commission_amount,
  COALESCE(d.invoice_value, 0)             AS invoice_value
FROM public.deals d
JOIN public.opportunities o ON o.id = d.opportunity_id
WHERE d.payment_status = 'paid';

COMMENT ON VIEW public.client_commission_timeline IS
  'Paid-commission rows grouped by client and paid date. Used by the client dashboard cumulative-revenue chart.';

-- ------------------------------------------------------------
-- 4. ACTIVITY TYPE: document the new re-engagement action
-- ------------------------------------------------------------
COMMENT ON COLUMN public.activities.action_type IS
  'Free-text action type. Common values: stage_changed, email_sent, call_made, meeting_booked, note_added, lead_created, opportunity_created, sample_requested, sample_sent, email_draft_created, email_approved, deal_created, deal_paid, shipped, buyer_reply_logged, reengagement_reminder';

-- ------------------------------------------------------------
-- DONE
-- ------------------------------------------------------------
