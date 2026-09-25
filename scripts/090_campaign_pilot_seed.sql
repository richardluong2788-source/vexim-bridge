-- ============================================================================
-- Migration 090: Campaign Engine B1 — Seed campaign pilot + sequence mặc định
-- ============================================================================
-- Campaign: "US Food Buyer – Vietnam Sourcing – Pilot"
-- Status 'draft' — KHÔNG tự enroll buyer nào. Việc chọn 50–100 buyer pilot
-- (food importer, đã sourcing từ VN, category khớp coverage, contact hợp lệ)
-- làm qua UI /admin/campaigns với preview trước khi enroll (spec §3 pilot).
--
-- Sequence theo spec §7 + chiến lược §12, shadow mode (tất cả qua approval):
--   S1  initial_outreach  day 0    — Introduction + relevance, không bán supplier
--   S2  follow_up         day +4   — Reinforce relevance (VN sourcing angle)
--   S3  follow_up         day +7   — Reduce friction (không hỏi "do you want suppliers?")
--   S4  close_loop        day +30  — Close loop, cho buyer quyền từ chối
-- Hết sequence mà vẫn im lặng → enrollment → NURTURE (state machine).
--
-- Idempotent. Safe to run multiple times.
-- ============================================================================

INSERT INTO public.campaigns (id, name, description, target_segment, product_category, status, start_date, daily_send_limit)
VALUES (
  '00000000-0000-0000-0000-0000000000c1',
  'US Food Buyer – Vietnam Sourcing – Pilot',
  'Pilot 50–100 buyer: food importer Mỹ, đã từng sourcing từ Vietnam, category khớp supplier coverage của Vexim, contact hợp lệ. Shipment count chỉ dùng làm biến ưu tiên. Shadow mode — mọi email AI sinh ra đều qua approval của AE.',
  'us_food_importer_vietnam_sourced',
  'food',
  'draft',
  CURRENT_DATE,
  20
)
ON CONFLICT (id) DO NOTHING;

-- Template sequence — đè NHẸ bằng ON CONFLICT DO UPDATE để chỉnh guidance mà
-- không phải migration mới (id cố định giúp seed này idempotent).
INSERT INTO public.campaign_steps (campaign_id, step_number, step_type, delay_days, objective, ai_prompt_guidance, max_attempts, stop_conditions)
VALUES
  ('00000000-0000-0000-0000-0000000000c1', 1, 'initial_outreach', 0,
   'Introduction + relevance. Không bán supplier ngay.',
   'Soft relevance: buyer đã sourcing category này cho thị trường Mỹ; Vexim là compliance consulting partner giúp nhà máy VN đạt chuẩn US (FDA/HACCP/traceability). KHÔNG giới thiệu supplier cụ thể, KHÔNG đề cập giá. 1 CTA mềm: open to connect.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}'),
  ('00000000-0000-0000-0000-0000000000c1', 2, 'follow_up', 4,
   'Reinforce relevance — góc "mở rộng supplier base".',
   'Nhắc nhẹ: nhiều buyer category này đang có sourcing từ Vietnam; Vexim có thể giúp mở rộng supplier base đạt chuẩn US. KHÔNG lặp lại nội dung email trước, KHÔNG tạo áp lực, NGẮN hơn email 1.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}'),
  ('00000000-0000-0000-0000-0000000000c1', 3, 'follow_up', 7,
   'Reduce friction — mở đường review sản phẩm, không hỏi "do you want suppliers?".',
   'KHÔNG hỏi "Do you want suppliers?". Thay bằng: nếu bạn đang review sản phẩm/spec nào, gửi qua tôi kiểm tra xem có manufacturer phù hợp không. Tone nhẹ, không pressure, ngắn.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}'),
  ('00000000-0000-0000-0000-0000000000c1', 4, 'close_loop', 30,
   'Close loop — cho buyer quyền từ chối.',
   'Email cuối: giả định có thể sai thời điểm, cho buyer quyền nói "không" một cách dễ dàng ("if this isn''t relevant, a simple no thanks is completely fine"). Sau email này dừng hoàn toàn.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}')
ON CONFLICT (campaign_id, step_number) DO UPDATE
SET step_type = EXCLUDED.step_type,
    delay_days = EXCLUDED.delay_days,
    objective = EXCLUDED.objective,
    ai_prompt_guidance = EXCLUDED.ai_prompt_guidance,
    max_attempts = EXCLUDED.max_attempts,
    stop_conditions = EXCLUDED.stop_conditions;
