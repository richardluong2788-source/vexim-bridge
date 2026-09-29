-- 089: Track which intake link produced each product
--
-- Why: product_intake_links.used_at was a single boolean-ish timestamp that
-- said "this link was touched once", which reads like the link is spent. It is
-- not - the token is deliberately multi-use for 30 days (see 085). With no
-- per-product link reference an AE could not tell how many products a
-- supplier had actually submitted, so the UI had to guess from used_at and
-- the "· Đã dùng" badge misled people into minting unnecessary new links.
--
-- Recording the link on each product makes the real count queryable, so the
-- badge can state the number instead of implying exhaustion.

ALTER TABLE public.client_products
  ADD COLUMN IF NOT EXISTS product_intake_link_id UUID
    REFERENCES public.product_intake_links(id) ON DELETE SET NULL;

-- The badge counts products per link, so index the column.
CREATE INDEX IF NOT EXISTS idx_client_products_intake_link
  ON public.client_products(product_intake_link_id)
  WHERE product_intake_link_id IS NOT NULL;

COMMENT ON COLUMN public.client_products.product_intake_link_id IS
  'Intake link this product was submitted through (NULL for products created inside the admin app)';

-- Backfill is intentionally not attempted: products created before this
-- migration have no recoverable link. A NULL simply means "unknown origin",
-- which is exactly what the column already means for admin-created rows.
