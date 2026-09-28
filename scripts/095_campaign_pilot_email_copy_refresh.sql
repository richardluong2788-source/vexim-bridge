-- ============================================================================
-- Migration 095: Replace the US food-buyer pilot email copy with the new
-- four-email sequence, while retaining context-driven personalization and all
-- campaign/scheduler/approval logic.
--
-- The generator still receives the same BuyerContext, step type, step
-- guidance, sender and real previous emails. Only the content direction for
-- the four pilot steps changes. This migration is idempotent.
-- ============================================================================

UPDATE public.campaign_steps AS step
SET objective = new_copy.objective,
    ai_prompt_guidance = new_copy.guidance
FROM (VALUES
  (
    1,
    'Buyer is doing too much initial supplier filtering; introduce Veximtrade as support for Vietnam-side sourcing groundwork.',
    $guidance$EMAIL 1 theo copy chiến dịch mới (subject direction: "Sourcing from Vietnam"): nêu chung rằng tìm supplier thường không khó bằng sàng lọc thông tin công ty, sản phẩm/specifications, thông tin xuất khẩu có sẵn, trao đổi giá, mẫu và yêu cầu nhập khẩu; không khẳng định buyer cụ thể đang gặp vấn đề đó. Giới thiệu Veximtrade làm phần tìm kiếm/sàng lọc ban đầu ở Việt Nam, xem xét product fit và yêu cầu U.S. liên quan trước khi giới thiệu supplier. Có thể nói về supplier verification chỉ ở mức đã được Veximtrade duyệt; không claim năng lực sản xuất, export history, chứng nhận hoặc kết quả kiểm tra cụ thể nếu Buyer Context không xác minh được. Cá nhân hóa bằng tên contact/company/category chỉ lấy từ Buyer Context nếu có giá trị thật. Nêu đã biết đến buyer/company khi nghiên cứu buyer U.S. trong category liên quan chỉ khi company/category thực sự có trong context. Mời trao đổi có điều kiện về việc Veximtrade có thể giảm bớt công việc cho team nếu Vietnam là thị trường buyer đang cân nhắc cho nguồn cung bổ sung; kết thúc bằng một câu hỏi nhẹ để buyer có cách trả lời rõ ràng. Không giới thiệu supplier cụ thể, không bịa buyer intent, không thêm ask chuyển tiếp tới contact khác.$guidance$
  ),
  (
    2,
    'Explain where Veximtrade fits in the sourcing process, rather than presenting a supplier list.',
    $guidance$EMAIL 2 theo copy chiến dịch mới (subject direction: "Veximtrade in the sourcing process"): làm rõ Veximtrade không phải danh sách supplier để buyer tự tìm/lọc; Veximtrade làm bước tìm kiếm và sàng lọc ban đầu tại Việt Nam, xem product fit và yêu cầu U.S. liên quan trước khi giới thiệu. Mời buyer gửi một product/spec cụ thể để xem nguồn cung Việt Nam có phù hợp không. Tham chiếu tự nhiên email trước nhưng không lặp subject, opening hoặc ý chính. Ngắn hơn Email 1, tone nhẹ, có opt-out mềm (ví dụ: "If this isn't relevant right now, just reply no and I won't follow up"). Cá nhân hóa chỉ từ dữ liệu Buyer Context có thật; không in placeholder/UNKNOWN/raw import data, không claim capacity, export history, certifications hoặc việc kiểm tra cụ thể nếu chưa được xác minh.$guidance$
  ),
  (
    3,
    'Sourcing time is also part of product-development cost; the buyer retains the supplier decision.',
    $guidance$EMAIL 3 theo copy chiến dịch mới (subject direction: "Sourcing is part of the cost"): tìm supplier, trao đổi, kiểm tra thông tin, báo giá, samples và yêu cầu nhập khẩu đều tốn thời gian; đó cũng là một phần chi phí trong phát triển sản phẩm. Veximtrade hỗ trợ phần tìm kiếm/sàng lọc ban đầu; buyer vẫn tự quyết supplier nào phù hợp và có tiếp tục hay không. Mời buyer gửi một product để Veximtrade xem sơ bộ product fit/khả năng có nguồn phù hợp. Không hỏi chung "Do you want suppliers?" Không lặp email trước, không gây áp lực; ngắn hơn Email 1, có opt-out mềm (ví dụ: "If this isn't relevant right now, just reply no and I won't follow up"). Cá nhân hóa chỉ theo dữ liệu Buyer Context có thật, không placeholder/UNKNOWN/raw import data hoặc claim chưa xác minh.$guidance$
  ),
  (
    4,
    'No-pressure final note; leave the door open for future Vietnam sourcing.',
    $guidance$EMAIL 4 theo copy chiến dịch mới (subject direction: "Additional supply from Vietnam"): thừa nhận Vietnam sourcing có thể chưa nằm trong kế hoạch hiện tại; nói rõ đây là email cuối trong thời gian tới và buyer không cần trả lời. Nếu sau này cần nguồn cung bổ sung từ Việt Nam, buyer có thể gửi product/requirements để Veximtrade xem có nguồn phù hợp không. Kết thúc ấm áp, ngắn gọn; không đặt câu hỏi, không ép chọn; có thể thêm câu "If this isn't relevant right now, a simple no thanks is completely fine" để buyer từ chối dễ dàng, rồi nói rõ không cần trả lời; đóng chuỗi hoàn toàn. Chỉ dùng contact/company/category từ Buyer Context nếu có dữ liệu thật; không placeholder/UNKNOWN/raw import data/claim chưa xác minh.$guidance$
  )
) AS new_copy(step_number, objective, guidance)
WHERE step.campaign_id = '00000000-0000-0000-0000-0000000000c1'
  AND step.step_number = new_copy.step_number;
