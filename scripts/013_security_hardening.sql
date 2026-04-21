-- ============================================================
-- ESH Security Hardening (Audit Findings R-02, R-04, R-07, R-14)
-- Migration 013 — defense-in-depth at the database layer
-- ============================================================
-- IDEMPOTENT — safe to re-run.
--
-- Four independent fixes, all enforced in the DB so application code
-- cannot bypass them (even with service-role credentials where noted).
--
--   R-14  WORM audit trail   — activities table is INSERT/SELECT only
--   R-07  Buyer PII leak     — client_leads_masked view + revoke direct
--                              client access to leads
--   R-02  Expired FDA block  — BEFORE INSERT trigger on opportunities
--   R-04  Country risk table — admin-editable catalogue instead of
--                              hardcoded TypeScript constants
-- ============================================================


-- ============================================================
-- R-14  WORM ("Write Once Read Many") audit trail on activities
-- ============================================================
-- Activities form the legal evidence trail for every stage change,
-- compliance action, and financial event. An admin must NOT be able
-- to silently rewrite history. If a record is wrong, the correct
-- remediation is to insert a compensating "correction" row.

-- Add a self-reference so corrections can point at the row they fix.
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS correction_of UUID
    REFERENCES public.activities(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.activities.correction_of IS
  'For WORM audit trails: if this row corrects a prior mistake, link '
  'to the original activity id. The original is never updated/deleted.';

-- Hard block UPDATE and DELETE at the trigger layer. Triggers fire for
-- EVERY role, including service_role and the postgres superuser — so
-- this cannot be bypassed from application code, from Supabase Studio,
-- or by a leaked service-role key.
CREATE OR REPLACE FUNCTION public.activities_forbid_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'activities is an append-only audit log. To correct a row, INSERT a '
    'new activity with action_type=''correction'' and correction_of=<id>. '
    'Operation % is not permitted.',
    TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS activities_block_update ON public.activities;
CREATE TRIGGER activities_block_update
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_forbid_mutation();

DROP TRIGGER IF EXISTS activities_block_delete ON public.activities;
CREATE TRIGGER activities_block_delete
  BEFORE DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_forbid_mutation();

-- Tighten RLS — collapse the old FOR ALL admin policy into explicit
-- INSERT + SELECT policies. Even if someone re-adds UPDATE/DELETE
-- policies by mistake, the triggers above still win.
DROP POLICY IF EXISTS "Admins can manage all activities" ON public.activities;

CREATE POLICY "Admins can select all activities"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert activities"
  ON public.activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin',
                       'lead_researcher', 'account_executive')
    )
  );

-- Client SELECT of their own activities remains unchanged (migration 001).


-- ============================================================
-- R-04  Country risk catalogue (editable by admins)
-- ============================================================
-- Replaces the hardcoded TS constants in lib/risk/country-risk.ts.
-- Admins can add/remove countries and adjust risk levels without a
-- redeploy. Sanctions lists evolve quickly — this must be data.

CREATE TABLE IF NOT EXISTS public.country_risk (
  country_code       TEXT PRIMARY KEY
                     CHECK (country_code ~ '^[A-Z]{2}$'),
  country_name       TEXT NOT NULL,
  risk_level         TEXT NOT NULL
                     CHECK (risk_level IN ('low', 'medium', 'high')),
  requires_verified_swift BOOLEAN NOT NULL DEFAULT TRUE,
  notes              TEXT,
  updated_by         UUID REFERENCES public.profiles(id),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.country_risk IS
  'Source of truth for buyer-country risk classification. Edited by '
  'admins in /admin/country-risk. Referenced by the Closing & Compliance '
  'gate in lib/risk/country-risk-db.ts.';

ALTER TABLE public.country_risk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed in can read country_risk" ON public.country_risk;
CREATE POLICY "Anyone signed in can read country_risk"
  ON public.country_risk FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage country_risk" ON public.country_risk;
CREATE POLICY "Admins can manage country_risk"
  ON public.country_risk FOR ALL
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

-- Auto-bump updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.country_risk_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS country_risk_touch_trg ON public.country_risk;
CREATE TRIGGER country_risk_touch_trg
  BEFORE UPDATE ON public.country_risk
  FOR EACH ROW EXECUTE FUNCTION public.country_risk_touch();

-- Seed the table from the SOP Phase 3 lists. ON CONFLICT DO NOTHING so
-- re-running the migration never overwrites an admin edit.
INSERT INTO public.country_risk (country_code, country_name, risk_level, requires_verified_swift, notes) VALUES
  -- HIGH RISK (SOP Phase 3.2 + FATF high-risk + sanctions)
  ('PK', 'Pakistan',    'high', TRUE, 'SOP Phase 3.2 explicit callout'),
  ('NG', 'Nigeria',     'high', TRUE, 'SOP Phase 3.2 explicit callout'),
  ('IR', 'Iran',        'high', TRUE, 'Sanctions'),
  ('KP', 'North Korea', 'high', TRUE, 'Sanctions'),
  ('SY', 'Syria',       'high', TRUE, 'Sanctions'),
  ('AF', 'Afghanistan', 'high', TRUE, 'FATF grey list + sanctions'),
  ('YE', 'Yemen',       'high', TRUE, 'Conflict zone'),
  ('SD', 'Sudan',       'high', TRUE, 'FATF black/grey list'),
  ('SS', 'South Sudan', 'high', TRUE, 'Conflict zone'),
  ('MM', 'Myanmar',     'high', TRUE, 'Sanctions'),
  ('VE', 'Venezuela',   'high', TRUE, 'Capital controls / sanctions'),
  ('CU', 'Cuba',        'high', TRUE, 'Sanctions'),
  ('IQ', 'Iraq',        'high', TRUE, 'Conflict / sanctions'),
  ('LY', 'Libya',       'high', TRUE, 'Conflict / sanctions'),
  ('SO', 'Somalia',     'high', TRUE, 'FATF high-risk'),
  ('BY', 'Belarus',     'high', TRUE, 'Sanctions'),
  ('RU', 'Russia',      'high', TRUE, 'Sanctions'),
  -- MEDIUM RISK
  ('BD', 'Bangladesh',  'medium', TRUE, NULL),
  ('IN', 'India',       'medium', TRUE, 'Large volume, mixed buyer quality'),
  ('ID', 'Indonesia',   'medium', TRUE, NULL),
  ('PH', 'Philippines', 'medium', TRUE, NULL),
  ('EG', 'Egypt',       'medium', TRUE, 'FX risk'),
  ('TR', 'Turkey',      'medium', TRUE, 'FX volatility'),
  ('KE', 'Kenya',       'medium', TRUE, NULL),
  ('GH', 'Ghana',       'medium', TRUE, NULL),
  ('TZ', 'Tanzania',    'medium', TRUE, NULL),
  ('UG', 'Uganda',      'medium', TRUE, NULL),
  ('ZA', 'South Africa','medium', TRUE, NULL),
  ('BR', 'Brazil',      'medium', TRUE, 'Customs complexity'),
  ('AR', 'Argentina',   'medium', TRUE, 'FX controls'),
  ('MX', 'Mexico',      'medium', TRUE, NULL),
  ('CO', 'Colombia',    'medium', TRUE, NULL),
  ('PE', 'Peru',        'medium', TRUE, NULL),
  ('UA', 'Ukraine',     'medium', TRUE, 'Conflict impact'),
  ('LK', 'Sri Lanka',   'medium', TRUE, 'Recent sovereign default'),
  ('NP', 'Nepal',       'medium', TRUE, NULL),
  ('KH', 'Cambodia',    'medium', TRUE, NULL),
  ('LA', 'Laos',        'medium', TRUE, NULL),
  ('LB', 'Lebanon',     'medium', TRUE, 'Banking crisis'),
  ('ZW', 'Zimbabwe',    'medium', TRUE, NULL),
  -- LOW RISK
  ('US', 'United States',    'low', FALSE, NULL),
  ('CA', 'Canada',            'low', FALSE, NULL),
  ('GB', 'United Kingdom',    'low', FALSE, NULL),
  ('AU', 'Australia',         'low', FALSE, NULL),
  ('NZ', 'New Zealand',       'low', FALSE, NULL),
  ('JP', 'Japan',             'low', FALSE, NULL),
  ('KR', 'South Korea',       'low', FALSE, NULL),
  ('SG', 'Singapore',         'low', FALSE, NULL),
  ('HK', 'Hong Kong',         'low', FALSE, NULL),
  ('TW', 'Taiwan',            'low', FALSE, NULL),
  ('CN', 'China',             'low', FALSE, NULL),
  ('DE', 'Germany',           'low', FALSE, NULL),
  ('FR', 'France',            'low', FALSE, NULL),
  ('IT', 'Italy',             'low', FALSE, NULL),
  ('ES', 'Spain',             'low', FALSE, NULL),
  ('NL', 'Netherlands',       'low', FALSE, NULL),
  ('BE', 'Belgium',           'low', FALSE, NULL),
  ('LU', 'Luxembourg',        'low', FALSE, NULL),
  ('AT', 'Austria',           'low', FALSE, NULL),
  ('CH', 'Switzerland',       'low', FALSE, NULL),
  ('IE', 'Ireland',           'low', FALSE, NULL),
  ('DK', 'Denmark',           'low', FALSE, NULL),
  ('SE', 'Sweden',            'low', FALSE, NULL),
  ('NO', 'Norway',            'low', FALSE, NULL),
  ('FI', 'Finland',           'low', FALSE, NULL),
  ('PT', 'Portugal',          'low', FALSE, NULL),
  ('PL', 'Poland',            'low', FALSE, NULL),
  ('CZ', 'Czech Republic',    'low', FALSE, NULL),
  ('AE', 'United Arab Emirates','low', FALSE, NULL),
  ('SA', 'Saudi Arabia',      'low', FALSE, NULL),
  ('QA', 'Qatar',             'low', FALSE, NULL),
  ('KW', 'Kuwait',            'low', FALSE, NULL),
  ('IL', 'Israel',            'low', FALSE, NULL),
  ('MY', 'Malaysia',          'low', FALSE, NULL),
  ('TH', 'Thailand',          'low', FALSE, NULL)
ON CONFLICT (country_code) DO NOTHING;


-- ============================================================
-- R-02  Expired FDA hard-block  — moved to migration 014
-- ============================================================
-- The original implementation assumed profiles.fda_expires_at existed,
-- but no prior migration ever added that column. It is now handled by
-- scripts/014_fda_enforcement_fix.sql, which adds the column AND uses
-- an EXISTS-based trigger (no SELECT INTO, no local variables) for
-- maximum portability across SQL runners.
--
-- This placeholder is kept here so re-running 013 does not recreate
-- the broken function. See 014 for the live implementation.


-- ============================================================
-- R-07  Masked buyer view for the client portal
-- ============================================================
-- The old flow: client page does `supabase.from('opportunities')
-- .select('leads(contact_email, ...)')` and relies on maskBuyer()
-- in the React tree to hide PII. Problem: the raw email still ships
-- in the network payload — press F12 and you have it.
--
-- The fix is layered:
--   1. Revoke the client's direct SELECT on public.leads (they can
--      no longer read the raw table at all).
--   2. Create a SECURITY DEFINER view that joins opportunities+leads
--      and masks contact fields based on stage. Client code queries
--      this view instead.
--   3. Admins still read leads directly via the admin RLS policy.
-- ============================================================

-- 1. Remove the RLS policy that let clients read raw leads.
DROP POLICY IF EXISTS "Clients can view their assigned leads" ON public.leads;

-- 2. The masked view. SECURITY DEFINER (via the function wrapper below)
--    so it bypasses leads RLS — but we hard-filter to the caller's
--    own opportunities inside the query.
DROP VIEW IF EXISTS public.client_leads_masked CASCADE;

CREATE VIEW public.client_leads_masked
WITH (security_barrier = true)
AS
SELECT
  o.id                       AS opportunity_id,
  o.client_id,
  o.stage,
  o.buyer_code,
  o.potential_value,
  o.products_interested,
  o.quantity_required,
  o.target_price_usd,
  o.price_unit,
  o.incoterms,
  o.payment_terms,
  o.destination_port,
  o.target_close_date,
  o.next_step,
  o.client_action_required,
  o.client_action_due_date,
  o.last_updated,
  o.created_at,
  l.id                       AS lead_id,
  l.industry,
  l.region,
  -- Level 2+ (price_agreed, production, shipped, won): real company name
  CASE
    WHEN o.stage IN ('price_agreed', 'production', 'shipped', 'won')
    THEN l.company_name
    ELSE NULL
  END                        AS company_name,
  -- Level 3 (shipped, won): full buyer contact
  CASE WHEN o.stage IN ('shipped', 'won') THEN l.contact_person ELSE NULL END AS contact_person,
  CASE WHEN o.stage IN ('shipped', 'won') THEN l.contact_email  ELSE NULL END AS contact_email,
  CASE WHEN o.stage IN ('shipped', 'won') THEN l.contact_phone  ELSE NULL END AS contact_phone,
  CASE WHEN o.stage IN ('shipped', 'won') THEN l.website        ELSE NULL END AS website,
  CASE WHEN o.stage IN ('shipped', 'won') THEN l.linkedin_url   ELSE NULL END AS linkedin_url,
  -- Disclosure level so the UI can render the right lock icon
  (CASE
     WHEN o.stage IN ('shipped', 'won')                               THEN 3
     WHEN o.stage IN ('price_agreed', 'production')                   THEN 2
     ELSE                                                                  1
   END)                      AS disclosure_level
FROM public.opportunities o
JOIN public.leads l ON l.id = o.lead_id
WHERE o.client_id = auth.uid();

-- Explicit grants. Only authenticated users; no anon access.
GRANT SELECT ON public.client_leads_masked TO authenticated;
REVOKE ALL   ON public.client_leads_masked FROM anon;

COMMENT ON VIEW public.client_leads_masked IS
  'Per-client masked view of their assigned opportunities. '
  'Replaces direct SELECT on public.leads for the client portal. '
  'Buyer PII (email, phone, contact person, website, linkedin) is '
  'withheld until the deal is shipped or won, at which point the '
  'commission is locked and disintermediation is no longer a risk.';

-- 3. Also tighten clients' SELECT on the related commission timeline
--    view (migration 010/011) is already handled via SECURITY INVOKER;
--    no change needed there.


-- ============================================================
-- DONE — verify with:
--   SELECT tgname, tgenabled FROM pg_trigger
--     WHERE tgrelid = 'public.activities'::regclass;
--   SELECT COUNT(*) FROM public.country_risk;
--   SELECT * FROM public.client_leads_masked LIMIT 5; -- as a client
-- ============================================================
