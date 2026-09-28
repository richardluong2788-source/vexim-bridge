-- 088: Ensure client_products has all extended fields used by admin/product dialogs
-- Some columns were added in code but migration was missing; make idempotent
-- Includes: packing & storage, payment terms, USP, origin, capacity, port, etc.

ALTER TABLE public.client_products
  ADD COLUMN IF NOT EXISTS price_unit TEXT,
  ADD COLUMN IF NOT EXISTS incoterm TEXT,
  ADD COLUMN IF NOT EXISTS incoterm_place TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT,
  ADD COLUMN IF NOT EXISTS key_specifications TEXT,
  ADD COLUMN IF NOT EXISTS usp TEXT,
  ADD COLUMN IF NOT EXISTS moq_value NUMERIC,
  ADD COLUMN IF NOT EXISTS moq_unit TEXT,
  ADD COLUMN IF NOT EXISTS lead_time TEXT,
  ADD COLUMN IF NOT EXISTS sample_available BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sample_notes TEXT,
  ADD COLUMN IF NOT EXISTS packing TEXT,
  ADD COLUMN IF NOT EXISTS package_size TEXT,
  ADD COLUMN IF NOT EXISTS shelf_life TEXT,
  ADD COLUMN IF NOT EXISTS storage_conditions TEXT,
  ADD COLUMN IF NOT EXISTS private_label_available BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS private_label_notes TEXT;

COMMENT ON COLUMN public.client_products.price_unit IS 'Price unit description e.g. per kg, per container';
COMMENT ON COLUMN public.client_products.incoterm IS 'Incoterm e.g. FOB, CIF';
COMMENT ON COLUMN public.client_products.incoterm_place IS 'Port / place for incoterm e.g. Cat Lai port';
COMMENT ON COLUMN public.client_products.payment_terms IS 'Payment terms e.g. TT 30/70, LC at sight';
COMMENT ON COLUMN public.client_products.country_of_origin IS 'Country of origin e.g. Vietnam';
COMMENT ON COLUMN public.client_products.key_specifications IS 'Key technical specs';
COMMENT ON COLUMN public.client_products.usp IS 'Unique selling points / standout features';
COMMENT ON COLUMN public.client_products.moq_value IS 'Minimum order quantity value';
COMMENT ON COLUMN public.client_products.moq_unit IS 'MOQ unit e.g. kg, container';
COMMENT ON COLUMN public.client_products.lead_time IS 'Lead time description';
COMMENT ON COLUMN public.client_products.packing IS 'Packing description e.g. 25kg PP bag';
COMMENT ON COLUMN public.client_products.package_size IS 'Package dimensions';
COMMENT ON COLUMN public.client_products.shelf_life IS 'Shelf life e.g. 12 months';
COMMENT ON COLUMN public.client_products.storage_conditions IS 'Storage conditions e.g. cool dry place';
