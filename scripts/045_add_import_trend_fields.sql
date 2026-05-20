-- Migration 045: Add import trend tracking fields
-- Adds: peak_months_data_year, import_trend for better historical context

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS peak_months_data_year INTEGER,
  ADD COLUMN IF NOT EXISTS import_trend TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.leads.peak_months_data_year IS 'Year of the peak months data (e.g. 2025, 2026 from ImportYeti)';
COMMENT ON COLUMN public.leads.import_trend IS 'Import trend: growing, declining, stable - to assess if buyer is active/scaling';
