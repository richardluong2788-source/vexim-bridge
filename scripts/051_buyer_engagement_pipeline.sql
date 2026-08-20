-- ============================================================
-- Migration 051: Buyer Engagement Pipeline (Pre-Client Workspace)
-- ============================================================
-- Adds a workspace for the phase between "AE claims a buyer from the
-- AI inbox" and "AE assigns the buyer to a client (creates an
-- opportunity)". This lets the AE:
--   1. Claim a buyer WITHOUT picking a client yet.
--   2. Ask the buyer (by email) about product, MOQ, target price,
--      payment terms, packaging and other requirements.
--   3. Record what the buyer answered.
--   4. Let AI shortlist 3-5 matching suppliers and share their public
--      profiles with the buyer via a tokenized link (no login needed).
--   5. Only after the buyer reacts to the shortlist does the AE pick
--      the final client(s) and create the opportunity — at which
--      point the buyer moves onto the normal Kanban pipeline.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. BUYER_ENGAGEMENTS — the pre-opportunity workspace itself
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_engagements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  account_manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inbox_item_id UUID REFERENCES public.ae_match_inbox(id) ON DELETE SET NULL,

  stage TEXT NOT NULL DEFAULT 'claimed'
    CHECK (stage IN (
      'claimed',                 -- AE claimed the buyer, no email sent yet
      'requirement_email_sent',  -- AE asked the buyer about their needs
      'requirements_received',   -- AE recorded what the buyer answered
      'shortlist_ready',         -- AI shortlist built, not shared yet
      'shortlist_sent',          -- Shortlist link sent to the buyer
      'buyer_viewed',            -- Buyer opened the shortlist link
      'buyer_responded',         -- Buyer marked interest on >=1 supplier
      'converted',               -- AE picked final client(s) -> opportunity
      'dropped'                  -- AE abandoned this buyer pre-conversion
    )),

  -- Buyer's stated sourcing requirements. Recorded by the AE from
  -- however the buyer actually answered (email, call, WhatsApp) —
  -- mirrors how buyer_replies content is pasted in today, just before
  -- an opportunity exists.
  requested_products TEXT,
  target_price_range TEXT,
  moq TEXT,
  payment_terms TEXT,
  packaging_requirements TEXT,
  other_requirements TEXT,

  dropped_reason TEXT,
  converted_at TIMESTAMPTZ,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one ACTIVE (not converted/dropped) engagement per buyer at a time,
-- so two AEs can't both be mid-workflow on the same lead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_engagements_active_lead
  ON public.buyer_engagements(lead_id)
  WHERE stage NOT IN ('converted', 'dropped');

CREATE INDEX IF NOT EXISTS idx_buyer_engagements_ae
  ON public.buyer_engagements(account_manager_id, stage);
CREATE INDEX IF NOT EXISTS idx_buyer_engagements_lead
  ON public.buyer_engagements(lead_id);

ALTER TABLE public.buyer_engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AE manage own engagements" ON public.buyer_engagements;
CREATE POLICY "AE manage own engagements"
  ON public.buyer_engagements FOR ALL
  USING (
    account_manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.handle_buyer_engagement_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_buyer_engagement_updated ON public.buyer_engagements;
CREATE TRIGGER on_buyer_engagement_updated
  BEFORE UPDATE ON public.buyer_engagements
  FOR EACH ROW EXECUTE FUNCTION public.handle_buyer_engagement_updated();

-- ------------------------------------------------------------
-- 2. BUYER_ENGAGEMENT_SHORTLIST — 3-5 AI-matched suppliers offered
--    to the buyer for a given engagement.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_engagement_shortlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES public.buyer_engagements(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  match_score NUMERIC(5, 2),
  ai_reasoning TEXT,

  -- NULL = no response yet, TRUE = buyer clicked "I'm interested",
  -- FALSE = buyer explicitly passed on this supplier.
  buyer_interested BOOLEAN,
  buyer_responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(engagement_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_engagement_shortlist_engagement
  ON public.buyer_engagement_shortlist(engagement_id, position);

ALTER TABLE public.buyer_engagement_shortlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AE manage own shortlists" ON public.buyer_engagement_shortlist;
CREATE POLICY "AE manage own shortlists"
  ON public.buyer_engagement_shortlist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_engagements e
      WHERE e.id = buyer_engagement_shortlist.engagement_id
        AND (
          e.account_manager_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'super_admin')
          )
        )
    )
  );

-- ------------------------------------------------------------
-- 3. SHORTLIST_SHARE_LINKS — public tokenized link the buyer opens to
--    view the shortlisted supplier profiles. Mirrors the
--    tokenized_share_links pattern already used for compliance docs:
--    the UUID token itself is the authorization bearer.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shortlist_share_links (
  token UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id UUID NOT NULL UNIQUE REFERENCES public.buyer_engagements(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shortlist_share_links_engagement
  ON public.shortlist_share_links(engagement_id);

ALTER TABLE public.shortlist_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AE manage own shortlist links" ON public.shortlist_share_links;
CREATE POLICY "AE manage own shortlist links"
  ON public.shortlist_share_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_engagements e
      WHERE e.id = shortlist_share_links.engagement_id
        AND (
          e.account_manager_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'super_admin')
          )
        )
    )
  );

-- NOTE: the public /shortlist/[token] route reads through the admin
-- (service-role) client and bypasses RLS entirely — same pattern as
-- /share/[token] — because the token itself is the auth bearer.

-- ------------------------------------------------------------
-- 4. EMAIL_DRAFTS — allow drafts BEFORE an opportunity exists, so the
--    AE can email the buyer to ask for requirements pre-client.
-- ------------------------------------------------------------
ALTER TABLE public.email_drafts
  ALTER COLUMN opportunity_id DROP NOT NULL;

ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES public.buyer_engagements(id) ON DELETE SET NULL;

ALTER TABLE public.email_drafts DROP CONSTRAINT IF EXISTS email_drafts_opportunity_or_lead_check;
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_opportunity_or_lead_check
  CHECK (opportunity_id IS NOT NULL OR lead_id IS NOT NULL);

ALTER TABLE public.email_drafts DROP CONSTRAINT IF EXISTS email_drafts_email_type_check;
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_email_type_check
  CHECK (email_type IN (
    'introduction', 'follow_up', 'quotation', 'sample_offer',
    'negotiation', 'custom', 'requirement_inquiry', 'shortlist_delivery'
  ));

CREATE INDEX IF NOT EXISTS idx_email_drafts_lead_id ON public.email_drafts(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_engagement_id ON public.email_drafts(engagement_id);

-- ------------------------------------------------------------
-- 5. BUYER_REPLIES — allow logging replies BEFORE an opportunity exists
-- ------------------------------------------------------------
ALTER TABLE public.buyer_replies
  ALTER COLUMN opportunity_id DROP NOT NULL;

ALTER TABLE public.buyer_replies
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES public.buyer_engagements(id) ON DELETE SET NULL;

ALTER TABLE public.buyer_replies DROP CONSTRAINT IF EXISTS buyer_replies_opportunity_or_lead_check;
ALTER TABLE public.buyer_replies
  ADD CONSTRAINT buyer_replies_opportunity_or_lead_check
  CHECK (opportunity_id IS NOT NULL OR lead_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_buyer_replies_lead_id ON public.buyer_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_buyer_replies_engagement_id ON public.buyer_replies(engagement_id);

-- ------------------------------------------------------------
-- DONE
-- ------------------------------------------------------------
COMMENT ON TABLE public.buyer_engagements IS
  'Pre-opportunity workspace for a claimed buyer: requirement gathering, AI supplier shortlist, and buyer response tracking, before an AE picks a final client and creates the opportunity.';

-- After running this migration:
--   1. Verify tables:  \dt public.buyer_engagement*  public.shortlist_share_links
--   2. Verify nullable: SELECT is_nullable FROM information_schema.columns
--                        WHERE table_name = 'email_drafts' AND column_name = 'opportunity_id';
-- ============================================================
