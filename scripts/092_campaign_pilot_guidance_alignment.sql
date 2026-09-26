-- ============================================================================
-- Migration 092: Alignment guidance campaign pilot với rule chống-trend-claim
-- (feedback 26/09/2026 — 4 chỉnh trước pilot)
-- ============================================================================
-- 090 seed guidance step 2 còn câu "nhiều buyer category này đang có sourcing
-- từ Vietnam" — bản thân nó là market-trend claim, AI sẽ dễ viết thành khẳng
-- định bị QA `trend_claim` chặn (HIGH). Sửa thành khung ĐIỀU KIỆN đúng rule.
-- Step 4 (close_loop) bổ sung rule "không ép chọn/không kết bằng câu hỏi"
-- khớp guidance mới của email-generator + QA close_loop_pressure.
-- Idempotent — safe to re-run. UPDATE thuần, không đổi schema.
-- ============================================================================

-- Step 2: reinforce relevance bằng khung điều kiện, không khẳng định trend.
UPDATE public.campaign_steps
SET objective = 'Reinforce relevance — khung điều kiện "nếu thêm nguồn VN nằm trong kế hoạch" (KHÔNG khẳng định trend).',
    ai_prompt_guidance = 'Nhắc nhẹ theo khung ĐIỀU KIỆN: "if adding a US-compliant Vietnamese origin alongside your current sources is on your roadmap..." — tuyệt đối KHÔNG khẳng định xu hướng thị trường (growing/expanding/many buyers are...). Có thể đề xuất spec-match shortcut. KHÔNG lặp nội dung email trước, KHÔNG tạo áp lực, NGẮN hơn email 1.'
WHERE campaign_id = '00000000-0000-0000-0000-0000000000c1'
  AND step_number = 2;

-- Step 4: close-loop phải THẬT SỰ đóng vòng — không ép buyer chọn phương án.
UPDATE public.campaign_steps
SET ai_prompt_guidance = 'Email cuối: giả định có thể sai thời điểm, cho buyer quyền nói "không" một cách dễ dàng ("if this isn''t relevant, a simple no thanks is completely fine"). NÓI RÕ đây là email cuối trong thời gian tới và không cần trả lời. KHÔNG kết bằng câu hỏi, KHÔNG ép chọn phương án ("which would you prefer?"). Sau email này dừng hoàn toàn.'
WHERE campaign_id = '00000000-0000-0000-0000-0000000000c1'
  AND step_number = 4;
