-- Migration: 084_price_attestation.sql
-- Purpose: Add price attestation checkbox for Vexim pricing policy
-- Requirement: checkbox "Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai."
-- Must be required before product save, stored as attestation.

ALTER TABLE public.client_products
  ADD COLUMN IF NOT EXISTS price_confirmed BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS price_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_attested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_attestation_text TEXT DEFAULT 'Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.';

COMMENT ON COLUMN public.client_products.price_confirmed IS 'Supplier attests price is not inflated for Vexim and reflects real commercial price at time of declaration';
COMMENT ON COLUMN public.client_products.price_attested_at IS 'When the price attestation was confirmed';
COMMENT ON COLUMN public.client_products.price_attested_by IS 'Who confirmed the attestation (user id)';
COMMENT ON COLUMN public.client_products.price_attestation_text IS 'Exact attestation wording stored for audit';

-- Backfill existing active products as not yet attested (require re-confirm on next edit)
-- Do not auto-confirm historical data to keep audit clean.

-- Index for compliance reporting
CREATE INDEX IF NOT EXISTS idx_client_products_price_confirmed ON public.client_products(price_confirmed) WHERE price_confirmed = FALSE;
