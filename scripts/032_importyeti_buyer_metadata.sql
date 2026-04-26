-- ============================================================
-- Migration 032: ImportYeti buyer metadata
-- ============================================================
-- Adds columns to public.leads to store the customs-trade-data
-- signal that admins parse from ImportYeti via the AI paste flow.
--
-- These fields are NOT PII (PII = contact_person/email/phone). They
-- describe the buyer's import behaviour and are safe to expose to
-- staff with BUYER_VIEW. Existing buyers keep NULL until enriched.
--
-- Idempotent: every column add is wrapped in IF NOT EXISTS so it
-- can be re-run safely.
-- ============================================================

-- 1) Free-text postal address shown on the customs records.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS import_address TEXT;

-- 2) US/foreign ports the buyer imports through (e.g. ["Long Beach", "Los Angeles"]).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS import_ports TEXT[];

-- 3) HS codes / Harmonized Tariff codes pulled from the customs filings.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS hs_codes TEXT[];

-- 4) Free-text product / category keywords (e.g. ["frozen shrimp", "seafood"]).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS product_keywords TEXT[];

-- 5) Number of customs shipments in the trailing 12 months (rough demand signal).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS customs_shipment_count INTEGER;

-- 6) Top suppliers the buyer is currently using.
--    Stored as JSONB array of objects: [{ "name": "...", "country": "VN" }, ...]
--    This is the most strategically valuable field — it tells the
--    Vietnamese exporter who they need to outcompete on price/quality.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS top_suppliers JSONB;

-- 7) Source URL / slug on ImportYeti so admins can jump back to the
--    original page if they need to verify or refresh the data.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_ref TEXT;

-- 8) When the customs data was last refreshed by AI parsing.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS customs_data_updated_at TIMESTAMP WITH TIME ZONE;

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
-- Lets the buyers directory filter "buyers from ImportYeti" cheaply
-- without scanning every row.
CREATE INDEX IF NOT EXISTS leads_source_idx ON public.leads (source);

-- GIN index on product_keywords powers buyer search by keyword
-- (e.g. all buyers importing "shrimp"). Skipped for hs_codes for
-- now — they're usually exact-matched in WHERE clauses.
CREATE INDEX IF NOT EXISTS leads_product_keywords_idx
  ON public.leads USING GIN (product_keywords);

-- ------------------------------------------------------------
-- NOTE: existing RLS on `leads` already covers these columns
-- because RLS is applied at the row level, not the column level.
-- Admins/staff retain full read/write; clients still only see leads
-- linked to them via opportunities (policy from migration 001).
-- ------------------------------------------------------------
