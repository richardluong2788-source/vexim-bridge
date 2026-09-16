-- ============================================================
-- Migration 077: Email delivery & engagement tracking
-- ============================================================
-- Resend outbound webhook events (delivered / delayed / opened /
-- clicked / bounced / complained) are recorded against the
-- email_drafts row that produced the message.
--
-- Open/click tracking is weak (Apple Mail Privacy Protection fires
-- synthetic opens), so columns are kept for reference only. Hard
-- bounces and spam complaints are RELIABLE and drive suppression:
-- once a lead is flagged, the app refuses to send them another
-- email (see lib/ai/email-sender.ts) — required by CAN-SPAM.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

-- ── email_drafts: per-message delivery state ────────────────────────────────
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
    CHECK (delivery_status IS NULL OR delivery_status IN (
      'sent', 'delivered', 'delayed', 'bounced', 'complained'
    )),
  ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delayed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_clicked_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_clicked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_type        TEXT,   -- 'hard' | 'soft'
  ADD COLUMN IF NOT EXISTS bounce_reason      TEXT,
  ADD COLUMN IF NOT EXISTS complained_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_at      TIMESTAMPTZ;

-- Outbound webhook events match by the Resend message id.
CREATE INDEX IF NOT EXISTS idx_email_drafts_resend_message_id
  ON public.email_drafts(resend_message_id)
  WHERE resend_message_id IS NOT NULL;

-- SMTP Message-ID header (angle brackets stripped). Referenced by inbound
-- reply matching (In-Reply-To) and as a secondary outbound-event match key;
-- historically this column was missing on some environments.
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS smtp_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_drafts_smtp_message_id
  ON public.email_drafts(smtp_message_id)
  WHERE smtp_message_id IS NOT NULL;

-- ── leads: address-level suppression ────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email_hard_bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_complained_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_suppression_note TEXT;

COMMENT ON COLUMN public.leads.email_hard_bounced_at IS
  'When a hard bounce was reported for this lead address. Outgoing email is blocked until cleared.';
COMMENT ON COLUMN public.leads.email_complained_at IS
  'When the recipient marked an email as spam. CAN-SPAM: never email this address again.';
COMMENT ON COLUMN public.email_drafts.opened_count IS
  'Reference only — Apple Mail Privacy Protection and corporate proxies produce synthetic opens.';

-- ============================================================
-- DONE
-- Also enable the outbound events in the Resend dashboard webhook:
--   email.delivered, email.delivery_delayed, email.opened,
--   email.clicked, email.bounced, email.complained
-- ============================================================
