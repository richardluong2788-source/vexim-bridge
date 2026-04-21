-- ============================================================
-- ESH (Export Sales Hub) - Phase 2 Schema Migration
-- Migration 002: Expand roles, stages, add deals & email_drafts
-- ============================================================
-- This migration is IDEMPOTENT — safe to run multiple times.
-- It preserves existing data and only expands the schema.
-- ============================================================


-- ============================================================
-- 1. PROFILES: Expand role enum
-- Keep existing roles (admin, staff, client) for backward compat,
-- add Phase 2 roles (super_admin, lead_researcher, account_executive)
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin',
    'staff',
    'client',
    'super_admin',
    'lead_researcher',
    'account_executive'
  ));


-- ============================================================
-- 2. LEADS: Add source + enriched_data for AI enrichment
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source TEXT;
  -- e.g. 'manual', 'linkedin_scraper', 'apollo', 'referral'

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS enriched_data JSONB DEFAULT '{}'::jsonb;
  -- Flexible bag: company size, revenue, tech stack, social, etc.

CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_enriched_data_gin
  ON public.leads USING GIN (enriched_data);


-- ============================================================
-- 3. OPPORTUNITIES: Expand stage enum to 10 stages
-- Phase 2 pipeline:
--   new → contacted → sample_requested → sample_sent →
--   negotiation → price_agreed → production → shipped → won / lost
-- Existing 'quoted' rows are migrated to 'price_agreed'.
-- ============================================================

-- Migrate legacy 'quoted' rows BEFORE changing constraint
UPDATE public.opportunities
  SET stage = 'price_agreed'
  WHERE stage = 'quoted';

-- Drop old constraint, add new one with 10 stages
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'new',
    'contacted',
    'sample_requested',
    'sample_sent',
    'negotiation',
    'price_agreed',
    'production',
    'shipped',
    'won',
    'lost'
  ));

-- Index for dashboard aggregations
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_client_id ON public.opportunities(client_id);


-- ============================================================
-- 4. DEALS: Post-win tracking (PO → Invoice → Commission)
-- Created when opportunity reaches 'price_agreed' or later.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  po_number TEXT,                                 -- Purchase Order number
  invoice_value DECIMAL(15, 2),                   -- Final invoice value USD
  commission_rate DECIMAL(5, 2) DEFAULT 5.00,     -- Percent, e.g. 5.00 = 5%
  commission_amount DECIMAL(15, 2)
    GENERATED ALWAYS AS (COALESCE(invoice_value, 0) * COALESCE(commission_rate, 0) / 100) STORED,
  payment_status TEXT
    CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue'))
    NOT NULL DEFAULT 'pending',
  invoice_pdf_url TEXT,                           -- Vercel Blob URL (private)
  shipped_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(opportunity_id)                          -- One deal per opportunity
);

CREATE INDEX IF NOT EXISTS idx_deals_opportunity_id ON public.deals(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_deals_payment_status ON public.deals(payment_status);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Admins / super_admin / account_executive can manage all deals
CREATE POLICY "Admins can manage all deals"
  ON public.deals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

-- Clients can view deals tied to their own opportunities
CREATE POLICY "Clients can view own deals"
  ON public.deals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = deals.opportunity_id
        AND o.client_id = auth.uid()
    )
  );

-- Auto-update updated_at on deal change
CREATE OR REPLACE FUNCTION public.handle_deal_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_deal_updated ON public.deals;
CREATE TRIGGER on_deal_updated
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_updated();


-- ============================================================
-- 5. EMAIL_DRAFTS: AI-generated email drafts awaiting approval
-- Flow: admin prompts in VI → AI generates EN → Google translates to VI
--       → admin reviews & approves → Resend sends → activity logged
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  email_type TEXT
    CHECK (email_type IN ('introduction', 'follow_up', 'quotation', 'sample_offer', 'negotiation', 'custom'))
    NOT NULL DEFAULT 'custom',
  ai_prompt TEXT NOT NULL,                        -- VI prompt from admin
  generated_subject TEXT,                         -- AI-generated subject (EN)
  generated_content_en TEXT,                      -- AI-generated body (EN)
  translated_content_vi TEXT,                     -- Google-translated preview (VI)
  status TEXT
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'rejected'))
    NOT NULL DEFAULT 'draft',
  recipient_email TEXT,                           -- Target email at send time
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  resend_message_id TEXT,                         -- Provider message id for tracking
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_opportunity_id
  ON public.email_drafts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status
  ON public.email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_by
  ON public.email_drafts(created_by);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

-- Only staff-side roles can manage email drafts (clients NEVER see drafts)
CREATE POLICY "Staff can manage email drafts"
  ON public.email_drafts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'admin', 'staff', 'super_admin',
          'lead_researcher', 'account_executive'
        )
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_email_draft_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_email_draft_updated ON public.email_drafts;
CREATE TRIGGER on_email_draft_updated
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_draft_updated();


-- ============================================================
-- 6. ACTIVITIES: Broaden action_type comment for Phase 2
-- No schema change needed — action_type is free-text.
-- New values used by Phase 2:
--   'sample_requested', 'sample_sent', 'email_draft_created',
--   'email_approved', 'email_sent', 'deal_created',
--   'deal_paid', 'shipped'
-- ============================================================
COMMENT ON COLUMN public.activities.action_type IS
  'Free-text action type. Common values: stage_changed, email_sent, call_made, meeting_booked, note_added, lead_created, opportunity_created, sample_requested, sample_sent, email_draft_created, email_approved, deal_created, deal_paid, shipped';


-- ============================================================
-- DONE
-- ============================================================
-- After running this migration:
--   1. Verify roles:    SELECT DISTINCT role FROM profiles;
--   2. Verify stages:   SELECT DISTINCT stage FROM opportunities;
--   3. Check tables:    \dt public.*   (expect: activities, deals, email_drafts, leads, opportunities, profiles)
-- ============================================================
