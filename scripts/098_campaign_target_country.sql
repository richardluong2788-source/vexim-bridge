-- Campaign target country is selected explicitly at campaign creation.
-- Buyer eligibility uses the existing leads.country value entered by LR.
-- The temporary leads.importing_country field is no longer used.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS target_country text;

COMMENT ON COLUMN public.campaigns.target_country IS
  'Explicit country selected for this outreach campaign; buyer eligibility matches leads.country against it.';

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS importing_country;
