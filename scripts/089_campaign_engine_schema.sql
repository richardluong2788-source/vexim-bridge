-- ============================================================================
-- Migration 089: Campaign Engine (B1) — Vexim AI Outreach Engine
-- ============================================================================
-- Lớp orchestration OUTREACH riêng biệt, KHÔNG đụng vào pipeline hiện có:
--   * buyer_engagements / opportunities giữ nguyên toàn bộ semantics.
--   * Không thêm crm_stage, không migrate CHECK constraint nào của bảng cũ.
--
-- Nội dung:
--   1. campaigns            — entity chiến dịch (spec §6)
--   2. campaign_steps       — template sequence (spec §7)
--   3. campaign_enrollments — 1 dòng / (buyer, campaign): state machine, timing,
--                             follow-up counters, next-action engine (spec §25)
--   4. campaign_step_firings— idempotency lock: 1 bước chỉ CLAIM được 1 lần
--                             (UNIQUE firing_key + INSERT ON CONFLICT). Cron retry
--                             / server restart không thể sinh email trùng.
--   5. buyer_interactions   — append-only interaction history (spec §5). RLS chỉ
--                             có SELECT + INSERT — không tồn tại policy UPDATE/DELETE.
--   6. ADD COLUMN (additive):
--        email_drafts.campaign_enrollment_id / campaign_step_number
--          → tái dùng 100% pipeline gửi/duyệt/tracking hiện có.
--        buyer_replies.campaign_intent / campaign_confidence /
--          campaign_intent_source / campaign_needs_human / campaign_enrollment_id
--          → classifier 7-intent cho campaign, KHÔNG đụng ai_intent (5 giá trị cũ).
--
-- Shadow mode: mọi email do AI sinh ra đều vào email_drafts với status
-- 'pending_approval' — gửi chỉ xảy ra khi AE bấm duyệt. Auto-send là quyết định
-- riêng, bật sau khi đo AI rejection rate 2–4 tuần (không nằm ở schema).
--
-- Idempotent. Safe to run multiple times.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. CAMPAIGNS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- Phân khúc mục tiêu, VD 'us_food_importer_vietnam_sourced'.
  -- TEXT tự do (không CHECK) để thêm segment mới không cần migration.
  target_segment TEXT,
  product_category TEXT,
  -- draft: chưa chạy; active: scheduler chạy; paused: dừng tạm toàn campaign;
  -- completed/archived: kết thúc (scheduler bỏ qua).
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date DATE,
  end_date DATE,
  -- Cap gửi/ngày toàn campaign (spec §22) — scheduler kiểm tra TRƯỚC khi sinh draft.
  daily_send_limit INTEGER NOT NULL DEFAULT 20,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

-- ------------------------------------------------------------
-- 2. CAMPAIGN_STEPS — template sequence
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  -- 1 = initial outreach, tăng dần. UNIQUE(campaign_id, step_number).
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL
    CHECK (step_type IN ('initial_outreach', 'follow_up', 'close_loop', 'nurture')),
  -- Số ngày chờ SAU khi bước trước kết thúc (last_contact_at nếu chưa có reply).
  delay_days INTEGER NOT NULL DEFAULT 0,
  -- Mục tiêu nghiệp vụ của bước — đầu vào của email generator (spec §12).
  objective TEXT,
  -- Guidance bổ sung cho AI (không phải prompt đầy đủ — prompt nằm trong lib/campaign).
  ai_prompt_guidance TEXT,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  -- Điều kiện dừng riêng của bước (jsonb, VD ["any_reply","opt_out","bounce"]).
  stop_conditions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign
  ON public.campaign_steps(campaign_id, step_number);

-- ------------------------------------------------------------
-- 3. CAMPAIGN_ENROLLMENTS — orchestration state per (buyer, campaign)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- State machine B1. Chỉ lib/campaign/state-machine.ts định nghĩa phép chuyển;
  -- cột này KHÔNG được update ngoài các code path của campaign engine.
  state TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (state IN (
      'enrolled',          -- vừa enroll, chưa làm gì
      'contact_pending',   -- email bước hiện tại đang chờ AE duyệt
      'contacted',         -- email bước hiện tại đã gửi, trong grace window
      'waiting_reply',     -- đang đợi buyer, có thể đến hạn follow-up
      'followup_1',        -- đã gửi follow-up 1, đang đợi
      'followup_2',        -- đã gửi follow-up 2 (close-loop), đang đợi
      'paused',            -- tạm dừng (NOT_NOW / OUT_OF_OFFICE) — có ngày quay lại
      'nurture',           -- hết sequence không reply → chăm sóc dài hạn (terminal B1)
      'replied_handoff',   -- buyer INTERESTED → đã/đang bàn giao buyer_engagements (terminal)
      'stopped',           -- NOT_INTERESTED (terminal)
      'suppressed',        -- OPT_OUT / bounce cứng / complained / unsubscribed (terminal)
      'invalid_contact'    -- WRONG_CONTACT / mất địa chỉ email (terminal)
    )),
  current_step_number INTEGER NOT NULL DEFAULT 1,
  followup_count INTEGER NOT NULL DEFAULT 0,

  -- Next Action Engine (spec §25): buyer active PHẢI luôn có next_action_at,
  -- trừ khi paused hoặc đang giữ cho human review. Cron integrity check duyệt.
  next_action_at TIMESTAMPTZ,
  next_action_type TEXT,

  last_contact_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,

  -- Human-in-the-loop: reply UNKNOWN / confidence thấp giữ enrollment lại.
  needs_human_review BOOLEAN NOT NULL DEFAULT false,
  human_review_reason TEXT,
  paused_until TIMESTAMPTZ,

  -- Bàn giao sang pipeline hiện có khi buyer INTERESTED.
  handoff_engagement_id UUID REFERENCES public.buyer_engagements(id) ON DELETE SET NULL,
  stopped_reason TEXT,

  -- AE sở hữu buyer trong campaign — dùng làm account_manager khi handoff.
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  enrolled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_id, lead_id)
);

-- 1 buyer chỉ nằm trong ĐÚNG 1 enrollment đang chạy (trên mọi campaign) —
-- tránh email chéo 2 campaign cùng lúc cho cùng một người.
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_enrollments_one_active_per_lead
  ON public.campaign_enrollments(lead_id)
  WHERE state NOT IN ('nurture', 'replied_handoff', 'stopped', 'suppressed', 'invalid_contact');

-- Query chính của scheduler: enrollment đến hạn xử lý.
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_scheduler
  ON public.campaign_enrollments(state, next_action_at)
  WHERE state IN ('enrolled', 'contacted', 'waiting_reply', 'followup_1', 'followup_2');

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_campaign
  ON public.campaign_enrollments(campaign_id, state);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_lead
  ON public.campaign_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_owner
  ON public.campaign_enrollments(owner_id, state);
-- Hàng đợi human review (reply UNKNOWN / confidence thấp).
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_review
  ON public.campaign_enrollments(campaign_id)
  WHERE needs_human_review = true;

ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;

-- Staff-side roles quản lý campaign enrollment; AE thấy enrollment mình sở hữu.
DROP POLICY IF EXISTS "Campaign enrollments staff manage" ON public.campaign_enrollments;
CREATE POLICY "Campaign enrollments staff manage"
  ON public.campaign_enrollments FOR ALL
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'account_executive', 'lead_researcher')
    )
  );

-- ------------------------------------------------------------
-- 4. CAMPAIGN_STEP_FIRINGS — idempotency lock cho mỗi bước
-- ------------------------------------------------------------
-- firing_key = '<enrollment_id>:<step_number>'. Scheduler CLAIM bằng
-- INSERT ... ON CONFLICT (firing_key) DO NOTHING: ai insert thành công là người
-- duy nhất được sinh draft cho bước đó. Cron retry/restart → 23505 → skip.
CREATE TABLE IF NOT EXISTS public.campaign_step_firings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  firing_key TEXT NOT NULL UNIQUE,
  -- claimed     : đã chiếm lock, đang sinh email
  -- draft_created: draft đang chờ AE duyệt
  -- sent        : AE đã duyệt & gửi
  -- failed      : lỗi (AI/QA/DB) — được retry bằng claim lại khi đã quá hạn
  -- skipped     : bỏ qua (stop condition phát sinh sau khi claim)
  status TEXT NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'draft_created', 'sent', 'failed', 'skipped')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  draft_id UUID,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_step_firings_enrollment
  ON public.campaign_step_firings(enrollment_id, step_number);
-- Dọn claim treo: claimed quá 30 phút mà chưa ra draft.
CREATE INDEX IF NOT EXISTS idx_campaign_step_firings_stuck
  ON public.campaign_step_firings(status, claimed_at)
  WHERE status = 'claimed';

ALTER TABLE public.campaign_step_firings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Campaign step firings staff manage" ON public.campaign_step_firings;
CREATE POLICY "Campaign step firings staff manage"
  ON public.campaign_step_firings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'account_executive', 'lead_researcher')
    )
  );

-- ------------------------------------------------------------
-- 5. BUYER_INTERACTIONS — append-only interaction history (spec §5)
-- ------------------------------------------------------------
-- KHÔNG overwrite: mọi sự kiện = 1 hàng mới. AE sửa draft → hàng EMAIL mới với
-- metadata.final_content, hàng cũ giữ nguyên.
CREATE TABLE IF NOT EXISTS public.buyer_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.campaign_enrollments(id) ON DELETE SET NULL,

  interaction_type TEXT NOT NULL
    CHECK (interaction_type IN ('EMAIL', 'REPLY', 'CALL', 'NOTE', 'MEETING', 'SYSTEM_EVENT')),
  direction TEXT NOT NULL
    CHECK (direction IN ('OUTBOUND', 'INBOUND', 'INTERNAL')),

  subject TEXT,
  -- Nội dung đầy đủ tại thời điểm ghi. Với EMAIL: AI draft (nếu có) + bản final.
  content TEXT,
  sender TEXT,
  recipient TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  campaign_id_snapshot UUID,
  sequence_step INTEGER,

  ai_generated BOOLEAN NOT NULL DEFAULT false,
  human_approved BOOLEAN NOT NULL DEFAULT false,

  -- Kết quả classifyCampaignReply (spec §14): intent/confidence/requires_human/rules.
  reply_classification JSONB,
  sentiment TEXT,
  intent TEXT,

  -- metadata JSONB tự do: draft_id, edited_content, qa_result, event payload…
  metadata JSONB,

  draft_id UUID,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_interactions_buyer
  ON public.buyer_interactions(buyer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_interactions_enrollment
  ON public.buyer_interactions(enrollment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_interactions_campaign_id
  ON public.buyer_interactions(campaign_id, occurred_at DESC);

ALTER TABLE public.buyer_interactions ENABLE ROW LEVEL SECURITY;

-- Append-only: chỉ SELECT + INSERT cho staff-side roles. CỐ Ý không có policy
-- UPDATE/DELETE — DB chặn overwrite ở tầng RLS.
DROP POLICY IF EXISTS "Buyer interactions staff read" ON public.buyer_interactions;
CREATE POLICY "Buyer interactions staff read"
  ON public.buyer_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'account_executive', 'lead_researcher', 'supplier_researcher')
    )
  );

DROP POLICY IF EXISTS "Buyer interactions staff insert" ON public.buyer_interactions;
CREATE POLICY "Buyer interactions staff insert"
  ON public.buyer_interactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'account_executive', 'lead_researcher')
    )
  );

COMMENT ON TABLE public.buyer_interactions IS
  'Append-only interaction history (spec §5). RLS intentionally has no UPDATE/DELETE policy — every event is a new row; history is never rewritten.';

-- ------------------------------------------------------------
-- 6. ADDITIVE COLUMNS trên bảng có sẵn
-- ------------------------------------------------------------

-- email_drafts: link campaign draft vào enrollment để tái dùng toàn bộ
-- approval + sending + delivery-tracking pipeline hiện có (opportunity_id NULL).
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS campaign_enrollment_id UUID
    REFERENCES public.campaign_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_step_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_email_drafts_campaign_enrollment
  ON public.email_drafts(campaign_enrollment_id)
  WHERE campaign_enrollment_id IS NOT NULL;

-- buyer_replies: kết quả classifier 7-intent của campaign — tách hẳn khỏi
-- ai_intent (5 giá trị, dùng cho pipeline cũ) để không migrate CHECK cũ.
ALTER TABLE public.buyer_replies
  ADD COLUMN IF NOT EXISTS campaign_intent TEXT,
  ADD COLUMN IF NOT EXISTS campaign_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS campaign_intent_source TEXT
    CHECK (campaign_intent_source IN ('ai', 'rules', 'ai+rules')),
  ADD COLUMN IF NOT EXISTS campaign_needs_human BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_enrollment_id UUID
    REFERENCES public.campaign_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_buyer_replies_campaign_enrollment
  ON public.buyer_replies(campaign_enrollment_id)
  WHERE campaign_enrollment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_replies_campaign_needs_human
  ON public.buyer_replies(campaign_needs_human)
  WHERE campaign_needs_human = true;

COMMENT ON COLUMN public.buyer_replies.campaign_intent IS
  'Campaign-engine reply intent (7 values: interested/not_interested/not_now/opt_out/out_of_office/wrong_contact/unknown). Separate from ai_intent which stays the 5-value legacy enum for the existing pipeline.';

-- ------------------------------------------------------------
-- 7. updated_at triggers (theo convention của repo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_campaign_table_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_campaigns_updated ON public.campaigns;
CREATE TRIGGER on_campaigns_updated
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_campaign_table_updated();

DROP TRIGGER IF EXISTS on_campaign_enrollments_updated ON public.campaign_enrollments;
CREATE TRIGGER on_campaign_enrollments_updated
  BEFORE UPDATE ON public.campaign_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_campaign_table_updated();
