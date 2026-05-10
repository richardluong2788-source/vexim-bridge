-- Migration 036: Add extended buyer fields to leads table
-- Adds: contact_title, hs_code, purchase_history, competitors, peak_months
-- Removes linkedin_url (optional, keep column but stop using)

-- Add new columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_title TEXT,
  ADD COLUMN IF NOT EXISTS hs_code TEXT,
  ADD COLUMN IF NOT EXISTS purchase_history TEXT,
  ADD COLUMN IF NOT EXISTS competitors TEXT,
  ADD COLUMN IF NOT EXISTS peak_months TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.leads.contact_title IS 'Job title of the contact person (e.g. Purchasing Manager)';
COMMENT ON COLUMN public.leads.hs_code IS 'Harmonized System code for product classification';
COMMENT ON COLUMN public.leads.purchase_history IS 'Historical purchases - volumes, origins, dates';
COMMENT ON COLUMN public.leads.competitors IS 'Main competitors (3-5) the buyer is working with';
COMMENT ON COLUMN public.leads.peak_months IS 'Peak purchasing months (e.g. Sep-Dec)';

-- Note: linkedin_url column is kept for backwards compatibility but no longer used in forms
-- Future migration can drop it after confirming no dependencies
