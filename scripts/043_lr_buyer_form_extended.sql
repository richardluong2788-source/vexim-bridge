-- ============================================================
-- Migration 043: LR Buyer Form Extended Fields
-- ============================================================
-- Adds new columns to public.leads to support the expanded
-- Leader Research buyer intake form as per the 7-section spec:
--
-- 1. THÔNG TIN ĐỊNH DANH - Địa chỉ, Link ImportYeti (source_ref exists)
-- 2. DỮ LIỆU ĐỊNH LƯỢNG - Tổng số lô, Ngày lô gần nhất, Avg TEU, 
--                        Top tháng cao/thấp điểm
-- 3. MÃ HS & SẢN PHẨM - Mã HS phụ (hs_codes[] exists), Sản phẩm chính
-- 4. CHUỖI CUNG ỨNG - Top suppliers (exists), Quốc gia nhập khẩu chính
-- 5. LOGISTICS - Cảng xuất, cảng đích, loại container
-- 6. GHI CHÚ CHO AI - Mô tả sản phẩm BOL, Mức độ ưu tiên
--
-- Idempotent: every column add is wrapped in IF NOT EXISTS.
-- ============================================================

-- Section 1: THÔNG TIN ĐỊNH DANH
-- import_address already exists from migration 032

-- Section 2: DỮ LIỆU ĐỊNH LƯỢNG (new fields for ImportYeti data)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS total_shipments INTEGER;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_shipment_date DATE;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS avg_teu_per_month NUMERIC(10, 2);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS top_peak_months TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS top_low_months TEXT;

-- Section 3: MÃ HS & SẢN PHẨM
-- hs_code (single) and hs_codes (array) already exist
-- product_keywords already exists from migration 032
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS main_product TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS secondary_hs_codes TEXT;

-- Section 4: CHUỖI CUNG ỨNG
-- top_suppliers already exists as JSONB from migration 032
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS main_import_countries TEXT;

-- Section 5: LOGISTICS
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origin_ports TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS destination_ports TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS container_types TEXT;

-- Section 6: GHI CHÚ CHO AI
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS bol_description TEXT;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS priority_rating SMALLINT;

-- ------------------------------------------------------------
-- Comments for documentation
-- ------------------------------------------------------------
COMMENT ON COLUMN public.leads.total_shipments IS 'Total shipment count from ImportYeti dashboard';
COMMENT ON COLUMN public.leads.last_shipment_date IS 'Most recent shipment date from ImportYeti';
COMMENT ON COLUMN public.leads.avg_teu_per_month IS 'Average TEU per month from ImportYeti';
COMMENT ON COLUMN public.leads.top_peak_months IS 'Top 3 peak months with shipment counts (e.g. "Aug:338, Jul:286, Sep:280")';
COMMENT ON COLUMN public.leads.top_low_months IS 'Top 3 low months with shipment counts (e.g. "Feb:112, Mar:105, Apr:104")';
COMMENT ON COLUMN public.leads.main_product IS 'Primary product name/description from LR';
COMMENT ON COLUMN public.leads.secondary_hs_codes IS 'Secondary HS codes if any (comma-separated)';
COMMENT ON COLUMN public.leads.main_import_countries IS 'Main importing countries with percentages (e.g. "Vietnam 68%, Brazil 8%")';
COMMENT ON COLUMN public.leads.origin_ports IS 'Top origin/export ports (e.g. "Vung Tau 46%, Singapore 11%")';
COMMENT ON COLUMN public.leads.destination_ports IS 'Top destination ports (e.g. "Norfolk VA 38%, Newark NJ 37%")';
COMMENT ON COLUMN public.leads.container_types IS 'Common container types (e.g. "20ft 63%, 40ft 37%")';
COMMENT ON COLUMN public.leads.bol_description IS 'Sample BOL product description for AI analysis';
COMMENT ON COLUMN public.leads.priority_rating IS 'LR priority rating 1-5 (5 = highest potential)';

-- ------------------------------------------------------------
-- Index on priority for quick sorting of high-priority buyers
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS leads_priority_rating_idx 
  ON public.leads (priority_rating DESC NULLS LAST);

-- ------------------------------------------------------------
-- NOTE: existing RLS on `leads` already covers these columns
-- because RLS is applied at the row level, not the column level.
-- ------------------------------------------------------------
