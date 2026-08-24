hận -- ============================================================================
-- Migration 063: unmatched_inbound_emails
-- ============================================================================
-- Context: app/api/webhooks/resend/route.ts previously did this when a
-- buyer's reply could not be matched to any opportunity or buyer_engagement:
--
--     if (!match && !engagementMatch) {
--       return NextResponse.json({ ok: true, skipped: "no_match" })
--     }
--
-- The reply was accepted (200 OK to Resend, so it never retries) but NEVER
-- PERSISTED anywhere — the buyer's message silently disappeared with no
-- trace in the app, even though Resend's "Receiving" log shows it arrived.
-- This is the #1 cause of "buyer replied but the AE never saw it".
--
-- This table gives every unmatched inbound email a permanent home so an
-- admin can review it, and (once a real buyer/engagement/opportunity is
-- identified) manually attach it via a buyer_replies row.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.unmatched_inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resend identifiers
  resend_email_id TEXT,
  message_id TEXT NOT NULL,

  -- Envelope
  from_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  in_reply_to TEXT,

  -- Body (best-effort extraction, same logic as buyer_replies.raw_content)
  raw_content TEXT,

  -- Why matching failed — kept for debugging (e.g. "no_contact_or_draft_match")
  match_attempt_note TEXT,

  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Manual triage by an admin
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,

  -- If an admin manually attaches this email to a real buyer, we record
  -- the resulting buyer_replies row so the UI can link straight to it.
  resolved_buyer_reply_id UUID REFERENCES public.buyer_replies(id) ON DELETE SET NULL
);

-- Dedup: Resend may re-deliver the same webhook event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unmatched_inbound_emails_message_id
  ON public.unmatched_inbound_emails (message_id);

-- Fast "still needs triage" list.
CREATE INDEX IF NOT EXISTS idx_unmatched_inbound_emails_unreviewed
  ON public.unmatched_inbound_emails (received_at DESC)
  WHERE reviewed = false;

COMMENT ON TABLE public.unmatched_inbound_emails IS
  'Inbound emails received via the Resend webhook that could not be matched to any opportunity or buyer_engagement (see findOpportunityByEmail / findEngagementByEmail in app/api/webhooks/resend/route.ts). Reviewed manually by an admin instead of being silently dropped.';

ALTER TABLE public.unmatched_inbound_emails ENABLE ROW LEVEL SECURITY;

-- Only admin/super_admin triage this queue (mirrors CAPS.ACTIVITY_LOG_VIEW
-- scoping used by app/admin/unmatched-emails). All access from the app
-- goes through the service-role admin client, so this policy is a backstop.
DROP POLICY IF EXISTS unmatched_inbound_emails_admin_all ON public.unmatched_inbound_emails;
CREATE POLICY unmatched_inbound_emails_admin_all
  ON public.unmatched_inbound_emails
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- DONE
-- ============================================================================
