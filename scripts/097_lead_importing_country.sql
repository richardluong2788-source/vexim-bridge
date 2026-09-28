-- HISTORICAL / SUPERSEDED by migration 098. This migration is retained for
-- databases that have already run it; 098 removes this temporary field and
-- introduces campaigns.target_country matched against the existing leads.country.
-- Do not apply 097 alone on a new database.
-- Migration 097: store the buyer's confirmed importing/destination country
-- separately from `country` (company location) and `main_import_countries`.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS importing_country text;

COMMENT ON COLUMN public.leads.importing_country IS
  'Explicitly confirmed importing/destination country. Do not populate from shipment origin-country aggregates.';
