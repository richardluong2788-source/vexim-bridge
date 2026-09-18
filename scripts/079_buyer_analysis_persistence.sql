-- ============================================================================
-- Migration 079: Lưu kết quả phân tích buyer (AI) trên bảng leads
--
-- Context
-- -------
-- Hệ thống ĐÃ có sẵn bộ phân tích buyer hoàn chỉnh:
--   * lib/ai/buyer-analyzer.ts          -> analyzeBuyer(): healthScore,
--     loyaltyScore, vietnamReadiness + breakdown chi tiết (thuần tính toán,
--     không tốn token).
--   * lib/ai/buyer-strategy-generator.ts -> generateBuyerStrategy(): góc tiếp
--     cận, talking points, rủi ro, thời điểm, tóm tắt chiến lược (gọi AI).
--   * components/admin/buyer-analysis-card.tsx -> UI hiển thị cả hai.
--
-- Vấn đề: card đó CHỈ được render trong smart-lead-form.tsx, tức là đúng một
-- lần lúc Lead Researcher đang nhập buyer. Kết quả không được lưu xuống DB
-- nên ngay sau khi bấm "Tạo buyer" là mất vĩnh viễn. Người cần đọc nó nhất
-- là AE — vài ngày / vài tuần sau đó, lúc chuẩn bị nói chuyện với buyer —
-- thì không có cách nào xem lại.
--
-- Không thể tính lại từ DB: analyzeBuyer() cần dữ liệu ImportYeti THÔ
-- (suppliers_table, hs_codes, recent_bols, time_series, map_table), trong khi
-- bảng leads chỉ lưu bản rút gọn (total_shipments, avg_teu_per_month,
-- top_suppliers JSONB...). Repo cũng không cache dữ liệu thô ở bất kỳ đâu.
-- Gọi lại ImportYeti + AI mỗi lần AE mở trang thì chậm (route đang phải đặt
-- maxDuration = 30) và tốn token cho một nội dung về bản chất là tĩnh.
--
-- Solution
-- --------
-- Lưu snapshot kết quả phân tích ngay lúc LR tạo buyer — dữ liệu khi đó ĐÃ
-- có sẵn trong state của smart-lead-form, chỉ việc gửi kèm lên server action.
-- Tab "Phân tích" trên hồ sơ buyer đọc thẳng từ DB: 0ms, 0 token, mở bao
-- nhiêu lần cũng được.
--
-- Buyer cũ (tạo trước migration này) sẽ có buyer_analysis IS NULL và được
-- UI xử lý bằng fallback heuristic SuggestedApproachCard — component này đã
-- viết sẵn trong buyer-detail-view.tsx nhưng chưa từng được render.
--
-- Downstream effects (xem code):
--   * CreateLeadWithAIMatchingInput nhận thêm buyerAnalysis/buyerStrategy
--     (app/admin/leads/new/actions.ts).
--   * smart-lead-form.tsx gửi state phân tích lên cùng lúc tạo buyer.
--   * app/admin/buyers/[id]/page.tsx đọc và truyền xuống BuyerDetailView.
--   * buyer-detail-view.tsx: tab "Phân tích" (đặt đầu tiên, mặc định).
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- 1) Snapshot BuyerAnalysisResult (lib/ai/buyer-analyzer.ts).
--    Lưu JSONB nguyên khối vì đây là kết quả tính toán có cấu trúc lồng nhau
--    (healthBreakdown / loyaltyBreakdown / vietnamBreakdown), không truy vấn
--    theo từng trường con.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS buyer_analysis JSONB;

-- 2) Snapshot BuyerStrategy (lib/ai/buyer-strategy-generator.ts).
--    Tách khỏi buyer_analysis vì strategy sinh ra từ LLM còn analysis là
--    pure function: có thể có analysis mà không có strategy (AI lỗi ->
--    generateFallbackStrategy, hoặc LR submit trước khi phân tích xong).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS buyer_strategy JSONB;

-- 3) Thời điểm snapshot được tạo — để UI hiện "phân tích lúc nào" và để
--    job backfill biết dòng nào đã cũ cần làm mới.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS buyer_analysis_at timestamptz;

-- 4) Model / phiên bản đã sinh ra strategy, để truy vết khi chất lượng
--    prompt thay đổi. NULL khi chỉ có analysis (không gọi AI).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS buyer_analysis_model text;

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
-- Phục vụ job backfill: quét các buyer CÓ link ImportYeti (source_ref, xem
-- migration 032) nhưng CHƯA có phân tích. Partial index nên rất nhỏ và
-- không tốn chi phí cho các truy vấn thông thường.
CREATE INDEX IF NOT EXISTS leads_buyer_analysis_backfill_idx
  ON public.leads (created_at DESC)
  WHERE buyer_analysis IS NULL
    AND source_ref IS NOT NULL;

-- ------------------------------------------------------------
-- Comments
-- ------------------------------------------------------------
COMMENT ON COLUMN public.leads.buyer_analysis IS
  'Snapshot BuyerAnalysisResult từ lib/ai/buyer-analyzer.ts (healthScore, '
  'loyaltyScore, vietnamReadiness + breakdown). Ghi một lần lúc LR tạo buyer '
  'từ dữ liệu ImportYeti. NULL = buyer cũ hoặc buyer nhập tay không qua '
  'ImportYeti -> UI fallback sang gợi ý heuristic. Migration 079.';

COMMENT ON COLUMN public.leads.buyer_strategy IS
  'Snapshot BuyerStrategy từ lib/ai/buyer-strategy-generator.ts '
  '(recommendedAngle, talkingPoints, riskFactors, timingSuggestion, '
  'approachSummary, confidenceScore). Có thể NULL ngay cả khi buyer_analysis '
  'có giá trị. Migration 079.';

COMMENT ON COLUMN public.leads.buyer_analysis_at IS
  'Thời điểm snapshot buyer_analysis/buyer_strategy được tạo. Migration 079.';

COMMENT ON COLUMN public.leads.buyer_analysis_model IS
  'Model AI đã sinh ra buyer_strategy (để truy vết khi đổi prompt). '
  'Migration 079.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Không cần policy mới: các cột này nằm trên bảng leads nên kế thừa toàn bộ
-- policy sẵn có. Chúng KHÔNG phải PII (PII của leads = contact_person /
-- contact_email / contact_phone) — giống nhóm cột ImportYeti ở migration 032,
-- đây là dữ liệu hành vi nhập khẩu suy ra từ nguồn công khai, an toàn cho mọi
-- role có BUYER_VIEW.

-- ------------------------------------------------------------
-- Rollback (nếu cần):
-- ------------------------------------------------------------
-- DROP INDEX IF EXISTS public.leads_buyer_analysis_backfill_idx;
-- ALTER TABLE public.leads
--   DROP COLUMN IF EXISTS buyer_analysis,
--   DROP COLUMN IF EXISTS buyer_strategy,
--   DROP COLUMN IF EXISTS buyer_analysis_at,
--   DROP COLUMN IF EXISTS buyer_analysis_model;
