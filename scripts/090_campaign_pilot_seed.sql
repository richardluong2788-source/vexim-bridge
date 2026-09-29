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
   'The buyer is doing too much of the initial supplier filtering; introduce Veximtrade as help with Vietnam-side sourcing groundwork.',
   'EMAIL 1 theo copy chiến dịch mới (subject direction: "Sourcing from Vietnam"): nêu chung rằng tìm supplier thường không khó bằng sàng lọc company/product/specs, export information, pricing, samples và import requirements; không khẳng định buyer cụ thể đang gặp vấn đề đó. Giới thiệu Veximtrade làm phần tìm kiếm/sàng lọc ban đầu ở Việt Nam, kiểm tra product fit và yêu cầu U.S. liên quan trước khi giới thiệu supplier. Cá nhân hóa lời mở bằng tên contact/company/category CHỈ từ Buyer Context nếu có dữ liệu thật; không in placeholder/UNKNOWN, không nêu ý định chưa biết, raw HS/shipment data, supplier cụ thể hay claim về capacity/export history/chứng nhận nếu chưa được xác minh. Kết bằng lời mời trao đổi có điều kiện nếu Vietnam là thị trường buyer đang cân nhắc cho nguồn cung bổ sung; kết thúc bằng một câu hỏi nhẹ. Không thêm ask chuyển tiếp tới contact khác.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}'),
  ('00000000-0000-0000-0000-0000000000c1', 2, 'follow_up', 4,
   'Explain where Veximtrade fits in the sourcing process, rather than presenting a supplier list.',
   'EMAIL 2 theo copy chiến dịch mới (subject direction: "Veximtrade in the sourcing process"): làm rõ Veximtrade không phải danh sách supplier để buyer tự tìm/lọc; Veximtrade làm bước tìm kiếm và sàng lọc ban đầu ở Việt Nam, kiểm tra product fit và yêu cầu U.S. liên quan trước khi giới thiệu. Mời buyer gửi một product/spec cụ thể để xem nguồn cung Việt Nam có phù hợp không. Dựa trên email trước nhưng không lặp subject, opening hoặc ý chính. Ngắn hơn Email 1, tone nhẹ, có opt-out mềm (ví dụ: "If this isn''t relevant right now, just reply no and I won''t follow up"). Chỉ cá nhân hóa từ dữ liệu Buyer Context có thật; không in placeholder/UNKNOWN/raw import data và không claim capacity, export history, certification hay việc kiểm tra cụ thể nếu chưa được xác minh.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}'),
  ('00000000-0000-0000-0000-0000000000c1', 3, 'follow_up', 7,
   'Explain that sourcing time is also part of the cost; the buyer retains the supplier decision.',
   'EMAIL 3 theo copy chiến dịch mới (subject direction: "Sourcing is part of the cost"): sourcing, trao đổi, kiểm tra thông tin, báo giá, samples và import requirements đều cần thời gian, và thời gian đó là một phần của product-development cost. Veximtrade hỗ trợ phần tìm kiếm/sàng lọc ban đầu; buyer vẫn tự quyết supplier suitability và có tiếp tục hay không. Mời buyer gửi product để Veximtrade kiểm tra sơ bộ product fit/source availability. Không hỏi chung "Do you want suppliers?" Không lặp email trước, không gây áp lực; ngắn hơn Email 1, có opt-out mềm (ví dụ: "If this isn''t relevant right now, just reply no and I won''t follow up"). Cá nhân hóa chỉ theo dữ liệu Buyer Context có thật, không placeholder/UNKNOWN/raw import data hoặc claim chưa xác minh.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}'),
  ('00000000-0000-0000-0000-0000000000c1', 4, 'close_loop', 30,
   'No-pressure final note; leave the door open for future Vietnam sourcing.',
   'EMAIL 4 theo copy chiến dịch mới (subject direction: "Additional supply from Vietnam"): nói rõ nếu Vietnam sourcing chưa nằm trong kế hoạch hiện tại thì đây là email cuối trong thời gian tới, không cần trả lời. Nếu sau này cần nguồn cung bổ sung từ Việt Nam, buyer có thể gửi product/requirements để Veximtrade xem có nguồn phù hợp không. Kết thúc ấm áp, ngắn gọn; không câu hỏi, không ép chọn; có thể dùng câu "If this isn''t relevant right now, a simple no thanks is completely fine" để buyer từ chối dễ dàng, nói rõ không cần trả lời và đóng chuỗi hoàn toàn. Chỉ dùng tên/company/category từ Buyer Context nếu có thật; không placeholder/UNKNOWN/raw import data/claim chưa xác minh.',
   1,
   '{"stop": ["any_reply", "opt_out", "hard_bounce", "invalid_contact"]}')
ON CONFLICT (campaign_id, step_number) DO UPDATE
SET step_type = EXCLUDED.step_type,
    delay_days = EXCLUDED.delay_days,
    objective = EXCLUDED.objective,
    ai_prompt_guidance = EXCLUDED.ai_prompt_guidance,
    max_attempts = EXCLUDED.max_attempts,
    stop_conditions = EXCLUDED.stop_conditions;
