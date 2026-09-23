-- ============================================================
-- 083: Provenance for products seeded from the intake product list
-- ============================================================
-- `client_intake_submissions.main_products` (064) is one free-text textarea, so
-- a factory's whole product range often arrives as a single comma sentence. The
-- splitter (`lib/client-intake/split-main-products.ts`) plus
-- `scripts/backfill-main-products.mjs` turn that text into real `client_products`
-- rows, and this column records which submission a row came from.
--
-- Why it matters:
--   * idempotency + audit: `AUTO-<hash>` product_code already prevents a re-run
--     from duplicating, but this column is what lets a human answer "why does
--     this client have a product called 'Các loại hạt'?" and delete exactly the
--     seeded set without touching rows an AE curated;
--   * the AE product manager can show "from intake" vs "typed by us".
--
-- Safety: additive only. Nothing here reads or writes `client_profiles`, so no
-- published profile (`is_published = true`) can change behaviour because of this
-- migration — the public surface is gated by `client_products.status`, which this
-- migration does not touch either.
-- ============================================================

ALTER TABLE public.client_products
    ADD COLUMN IF NOT EXISTS source_submission_id UUID
        REFERENCES public.client_intake_submissions(id) ON DELETE SET NULL;

-- Only seeded rows carry a value, so the index stays tiny.
CREATE INDEX IF NOT EXISTS client_products_source_submission_idx
    ON public.client_products (source_submission_id)
    WHERE source_submission_id IS NOT NULL;

COMMENT ON COLUMN public.client_products.source_submission_id IS
    'client_intake_submissions.id whose free-text main_products this row was split from. NULL = curated by a human (or predates migration 083). Set by lib/client-intake/seed-products-from-intake.ts; never rewritten by the app.';

-- Verify (expect the column once, and no rows yet on a fresh deploy):
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'client_products' and column_name = 'source_submission_id';
--   select count(*) from public.client_products where source_submission_id is not null;
--
-- Rollback (drops only provenance; the product rows themselves stay):
--   drop index if exists public.client_products_source_submission_idx;
--   alter table public.client_products drop column if exists source_submission_id;
