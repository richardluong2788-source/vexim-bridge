-- ============================================================
-- Migration 061: Track which channel the AE actually used to reach
-- the buyer before recording their requirements.
-- ============================================================
-- Problem this fixes
-- -------------------
-- The "Ghi nhận nhu cầu buyer" (Record buyer requirements) action only
-- ever appeared once an engagement reached stage = 'requirement_email_sent'
-- (i.e. the AE sent the in-system AI-drafted email). In practice AEs
-- often reach out to a buyer OUTSIDE the system first (LinkedIn,
-- WhatsApp, phone) and only later learn the buyer's actual sourcing
-- needs. Those buyers got stuck at 'claimed' with no way to enter what
-- was learned.
--
-- Fix
-- ---
-- 1. Add `contact_channel` + `contact_channel_note` to buyer_engagements
--    so the AE records HOW the buyer was actually reached whenever they
--    save requirements — whether or not the in-system email step ran.
-- 2. The app now allows "Ghi nhận nhu cầu buyer" from BOTH the 'claimed'
--    and 'requirement_email_sent' stages (application-level change, no
--    schema change needed for that part — 'claimed' -> 'requirements_received'
--    is already a legal stage per the existing CHECK constraint).
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

ALTER TABLE public.buyer_engagements
  ADD COLUMN IF NOT EXISTS contact_channel TEXT
    CHECK (contact_channel IN ('system_email', 'linkedin', 'whatsapp', 'phone', 'other')),
  ADD COLUMN IF NOT EXISTS contact_channel_note TEXT;

COMMENT ON COLUMN public.buyer_engagements.contact_channel IS
  'How the AE actually reached the buyer to gather requirements: the in-system email (system_email), or an outside channel (linkedin/whatsapp/phone/other). Recorded whenever buyer requirements are saved, regardless of which stage the engagement came from.';
COMMENT ON COLUMN public.buyer_engagements.contact_channel_note IS
  'Optional free-text note for the outside-channel case, e.g. a LinkedIn profile URL or phone number used.';

-- Backfill: engagements that already went through the in-system email
-- step obviously used it.
UPDATE public.buyer_engagements
SET contact_channel = 'system_email'
WHERE contact_channel IS NULL
  AND stage NOT IN ('claimed');

-- ============================================================
-- DONE
-- ============================================================
