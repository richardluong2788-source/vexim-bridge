-- ============================================================
-- Migration 052: Immutable Shortlist Snapshots + Multi-Opportunity
-- Conversion + Buyer Action Tracking
-- ============================================================
-- Problem this fixes:
--   051's buyer_engagement_shortlist stored only a score + reasoning
--   pointer, and that pointer kept resolving LIVE against
--   client_profiles/scoring. If a supplier edited their profile or the
--   AI model changed, a proposal the AE already sent to a buyer would
--   silently reflect different data than what the buyer actually saw.
--
-- Fix:
--   - Shortlists become versioned (buyer_engagement_shortlist_versions).
--     Only ONE version per engagement is 'sent' (immutable, live to the
--     buyer) at a time. Editing after sending creates a NEW version;
--     the old one is kept forever as 'superseded' for audit.
--   - Each supplier row in a version (buyer_engagement_shortlist_items)
--     freezes: match score, factor breakdown, reasoning, remaining
--     risks, which data fields were used, AI model/scoring-engine
--     version, supplier-profile version (updated_at snapshot), buyer
--     requirements snapshot, who approved it and when.
--   - buyer_engagements gets a 'qualified_interest' stage between
--     buyer_responded and converted, so AE can record a buyer action
--     (opened profile / asked question / requested sample / requested
--     meeting / picked primary supplier / sent target price+volume /
--     sent PO) before deciding to convert. This is advisory only — the
--     AE always keeps the final call.
--   - opportunities gets source_engagement_id + source_role
--     (primary/backup/alternative) so multiple opportunities created
--     from one engagement (multi-supplier buyer) can be traced back for
--     commission accounting.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop the old score-pointer shortlist table (051). No production
--    data depends on it yet (this feature has not shipped), so we
--    recreate it as the versioned model below instead of migrating rows.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.buyer_engagement_shortlist CASCADE;

-- ------------------------------------------------------------
-- 2. BUYER_ENGAGEMENT_SHORTLIST_VERSIONS — one shortlist "proposal"
--    sent (or about to be sent) to a buyer. Immutable once sent.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_engagement_shortlist_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES public.buyer_engagements(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'superseded')),

  -- Frozen at build time — the buyer's stated requirements as they
  -- existed when this version was built, independent of later edits
  -- to buyer_engagements.
  requirements_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Which scoring/AI logic produced this version's item scores.
  scoring_engine_version TEXT NOT NULL,
  ai_model_version TEXT,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Set when an AE reviews the draft and approves it for sending.
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,

  sent_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,

  UNIQUE(engagement_id, version_number)
);

-- Only one 'sent' version live per engagement at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shortlist_versions_one_sent
  ON public.buyer_engagement_shortlist_versions(engagement_id)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_shortlist_versions_engagement
  ON public.buyer_engagement_shortlist_versions(engagement_id, version_number DESC);

ALTER TABLE public.buyer_engagement_shortlist_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AE manage own shortlist versions" ON public.buyer_engagement_shortlist_versions;
CREATE POLICY "AE manage own shortlist versions"
  ON public.buyer_engagement_shortlist_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_engagements e
      WHERE e.id = buyer_engagement_shortlist_versions.engagement_id
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
-- 3. BUYER_ENGAGEMENT_SHORTLIST_ITEMS — one supplier row inside a
--    shortlist version. Everything here is a frozen snapshot; it must
--    NEVER be recomputed or overwritten after the parent version is
--    'sent'. To change a supplier's presentation, create a new version.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_engagement_shortlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.buyer_engagement_shortlist_versions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,

  -- Frozen scoring result.
  match_score NUMERIC(5, 2) NOT NULL,
  match_factors JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{factor, details, points}, ...]
  match_reasoning TEXT,
  remaining_risks TEXT,
  data_fields_used JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["main_product","hs_code","trust_label"]

  -- Frozen supplier presentation — copied from client_profiles at
  -- build time so a later profile edit can't silently change what the
  -- buyer already saw.
  supplier_profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  supplier_profile_version TIMESTAMPTZ, -- client_profiles.updated_at at snapshot time

  -- Buyer's reaction to THIS supplier, on THIS version.
  buyer_interested BOOLEAN,
  buyer_action TEXT
    CHECK (buyer_action IS NULL OR buyer_action IN (
      'viewed_only', 'interested_no_details', 'requested_info',
      'requested_sample', 'requested_meeting', 'selected_primary',
      'sent_price_volume', 'sent_po'
    )),
  buyer_responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(version_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlist_items_version
  ON public.buyer_engagement_shortlist_items(version_id, position);
CREATE INDEX IF NOT EXISTS idx_shortlist_items_client
  ON public.buyer_engagement_shortlist_items(client_id);

ALTER TABLE public.buyer_engagement_shortlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AE manage own shortlist items" ON public.buyer_engagement_shortlist_items;
CREATE POLICY "AE manage own shortlist items"
  ON public.buyer_engagement_shortlist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_engagement_shortlist_versions v
      JOIN public.buyer_engagements e ON e.id = v.engagement_id
      WHERE v.id = buyer_engagement_shortlist_items.version_id
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
-- 4. shortlist_share_links now point at a VERSION, not the engagement,
--    so the public link always resolves to one immutable snapshot.
--    (051 pointed at engagement_id; re-point to the sent version.)
-- ------------------------------------------------------------
ALTER TABLE public.shortlist_share_links
  ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.buyer_engagement_shortlist_versions(id) ON DELETE CASCADE;

-- Drop the old 1:1-with-engagement uniqueness; a new version needs a
-- new link (old links for superseded versions must keep working for
-- anyone who already has the URL, pointing at the frozen snapshot).
ALTER TABLE public.shortlist_share_links DROP CONSTRAINT IF EXISTS shortlist_share_links_engagement_id_key;
CREATE INDEX IF NOT EXISTS idx_shortlist_share_links_version
  ON public.shortlist_share_links(version_id);

-- ------------------------------------------------------------
-- 5. BUYER_ENGAGEMENTS — add 'qualified_interest' stage (advisory
--    checkpoint before convert) and a place to store the AE's chosen
--    buyer-action classification at the engagement level (mirrors the
--    "does this action justify an opportunity" table).
-- ------------------------------------------------------------
ALTER TABLE public.buyer_engagements DROP CONSTRAINT IF EXISTS buyer_engagements_stage_check;
ALTER TABLE public.buyer_engagements
  ADD CONSTRAINT buyer_engagements_stage_check
  CHECK (stage IN (
    'claimed',
    'requirement_email_sent',
    'requirements_received',
    'shortlist_ready',
    'shortlist_sent',
    'buyer_viewed',
    'buyer_responded',
    'qualified_interest',   -- AE logged a buyer action; deciding whether to convert
    'converted',
    'dropped'
  ));

-- ------------------------------------------------------------
-- 6. OPPORTUNITIES — trace which engagement + role produced this
--    opportunity, so multiple suppliers chosen by one buyer (primary,
--    backup, alternative) can each get their own opportunity while
--    staying linked for commission accounting.
-- ------------------------------------------------------------
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS source_engagement_id UUID REFERENCES public.buyer_engagements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_role TEXT
    CHECK (source_role IS NULL OR source_role IN ('primary', 'backup', 'alternative'));

CREATE INDEX IF NOT EXISTS idx_opportunities_source_engagement
  ON public.opportunities(source_engagement_id);

-- ------------------------------------------------------------
-- DONE
-- ------------------------------------------------------------
COMMENT ON TABLE public.buyer_engagement_shortlist_versions IS
  'One versioned, approvable shortlist proposal per engagement. Once status=sent, the version and its items are immutable audit records — edits create a new version instead of mutating this one.';
COMMENT ON TABLE public.buyer_engagement_shortlist_items IS
  'Frozen snapshot of one supplier inside a shortlist version: score, factors, reasoning, risks, data used, AI/scoring version, and supplier-profile version at proposal time. Never recompute in place.';

-- After running this migration:
--   1. Verify tables: \dt public.buyer_engagement_shortlist_versions public.buyer_engagement_shortlist_items
--   2. Verify columns: SELECT column_name FROM information_schema.columns
--                       WHERE table_name = 'opportunities' AND column_name LIKE 'source_%';
-- ============================================================
