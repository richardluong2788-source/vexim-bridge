-- Migration 097: store the buyer's confirmed importing/destination country
-- separately from `country` (company location) and `main_import_countries`
-- (supplier/origin countries aggregated from ImportYeti shipment records).
-- Apply after 096. Existing rows intentionally remain NULL until verified.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS importing_country text;

COMMENT ON COLUMN public.leads.importing_country IS
  'Explicitly confirmed importing/destination country. Do not populate from shipment origin-country aggregates.';
