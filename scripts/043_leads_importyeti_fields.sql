-- ============================================================
-- Migration 043: Add ImportYeti data fields to leads table
-- For Lead Researcher to enter detailed buyer intelligence
-- ============================================================

-- Section 1: THÔNG TIN ĐỊNH DANH
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS importyeti_url TEXT;

-- Section 2: DỮ LIỆU ĐỊNH LƯỢNG (from ImportYeti dashboard)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS total_shipments INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS latest_shipment_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avg_teu_per_month DECIMAL(10, 2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS top_peak_months TEXT; -- "Tháng 8:338, tháng 7:286, tháng 9:280"
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS top_low_months TEXT;  -- "Tháng 2:112, tháng 3:105, tháng 4:104"

-- Section 3: MÃ HS & SẢN PHẨM
-- hs_code already exists, rename concept to main_hs_codes for clarity
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS main_hs_codes TEXT; -- "0801.32, 0801.31" (1-3 codes)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS product_description TEXT; -- Main product commercial name
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS secondary_hs_codes TEXT; -- Other HS codes appearing less frequently

-- Section 4: CHUỖI CUNG ỨNG HIỆN TẠI
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS top_suppliers TEXT; -- "Thao Tam (VN), Tai Nhung (VN), Comextra (ID)"
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS import_countries TEXT; -- "Vietnam (68%), Brazil (8%), Indonesia (3%)"

-- Section 5: LOGISTICS
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS export_ports TEXT; -- "Vung Tau (46%), Singapore (11%)"
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS destination_ports TEXT; -- "Norfolk VA (38%), Newark NJ (37%)"
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS container_types TEXT; -- "20ft (63%), 40ft (37%)"

-- Section 6: GHI CHÚ CHO AI
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sample_bol_description TEXT; -- Copy 1-2 lines from Bill of Lading
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lr_notes TEXT; -- LR's observations/insights
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_rating INTEGER CHECK (priority_rating >= 1 AND priority_rating <= 5); -- 1-5 stars
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_source TEXT; -- Where contact was found (BOL, LinkedIn, etc.)

-- Update contact_title if not exists (for "Chức vụ")
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_title TEXT;

-- Index for ImportYeti URL uniqueness check (optional, for dedup)
CREATE INDEX IF NOT EXISTS idx_leads_importyeti_url ON public.leads(importyeti_url) WHERE importyeti_url IS NOT NULL;

-- Index for priority rating queries
CREATE INDEX IF NOT EXISTS idx_leads_priority_rating ON public.leads(priority_rating) WHERE priority_rating IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.leads.importyeti_url IS 'ImportYeti company/supplier page URL for reference';
COMMENT ON COLUMN public.leads.total_shipments IS 'Total number of shipments from ImportYeti dashboard';
COMMENT ON COLUMN public.leads.avg_teu_per_month IS 'Average TEU per month from ImportYeti';
COMMENT ON COLUMN public.leads.top_peak_months IS 'Top 3 peak months with shipment counts';
COMMENT ON COLUMN public.leads.top_low_months IS 'Top 3 low months with shipment counts';
COMMENT ON COLUMN public.leads.main_hs_codes IS 'Primary HS codes (1-3) from Product Breakdown';
COMMENT ON COLUMN public.leads.top_suppliers IS 'Top 5 current suppliers with country';
COMMENT ON COLUMN public.leads.import_countries IS 'Main import countries with percentages';
COMMENT ON COLUMN public.leads.export_ports IS 'Main export ports with percentages';
COMMENT ON COLUMN public.leads.destination_ports IS 'Main destination ports with percentages';
COMMENT ON COLUMN public.leads.container_types IS 'Common container types used';
COMMENT ON COLUMN public.leads.sample_bol_description IS 'Sample product description from BOL';
COMMENT ON COLUMN public.leads.lr_notes IS 'Lead Researcher notes and observations';
COMMENT ON COLUMN public.leads.priority_rating IS 'LR priority rating 1-5 stars';
