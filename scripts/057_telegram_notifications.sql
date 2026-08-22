-- ============================================================================
-- Telegram notification channel
--
-- Adds a second delivery channel (alongside email) so AEs get an instant
-- push to their phone even when the web app is closed. Mirrors the shape of
-- the email channel added in 006 so the dispatcher can treat both uniformly.
--
-- Design notes:
--   * `telegram_link_token` is a one-time code shown on the Settings page.
--     The user sends `/start <token>` to the bot; the webhook resolves the
--     token to a user and stores the resulting `chat_id`. The token is
--     rotated (regenerated) whenever it's consumed or reissued so it can't
--     be replayed.
--   * `telegram_chat_id` is null until linked. UI should show a "Link
--     Telegram" CTA when null and "Connected as @handle" once set.
--   * `notification_telegram_log` mirrors `notification_email_log`: one row
--     per (user_id, dedup_key) written BEFORE calling the Telegram API, so a
--     retried server action can never double-send.
-- ============================================================================

-- 1) Telegram fields on notification_preferences ------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS telegram_enabled               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_chat_id               text,
  ADD COLUMN IF NOT EXISTS telegram_username              text,
  ADD COLUMN IF NOT EXISTS telegram_action_required       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_status_update         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_deal_closed           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_new_assignment        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_link_token            uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS telegram_link_token_expires_at timestamptz;

-- One Telegram chat can only ever be linked to one user.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notification_prefs_telegram_chat_id
  ON public.notification_preferences(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Webhook looks up the pending link by token.
CREATE INDEX IF NOT EXISTS idx_notification_prefs_telegram_link_token
  ON public.notification_preferences(telegram_link_token);

-- 2) Telegram delivery log (idempotency) --------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_telegram_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dedup_key   text NOT NULL,
  message_id  text, -- Telegram's message_id from the sendMessage response
  status      text NOT NULL DEFAULT 'sent'
                CHECK (status IN ('sent','failed','skipped')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_telegram_log_user_dedup
  ON public.notification_telegram_log(user_id, dedup_key);

ALTER TABLE public.notification_telegram_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_log_admin_all" ON public.notification_telegram_log;
CREATE POLICY "telegram_log_admin_all" ON public.notification_telegram_log
  FOR ALL
  USING (public.get_current_user_role() IN ('admin','staff','super_admin'))
  WITH CHECK (public.get_current_user_role() IN ('admin','staff','super_admin'));

-- Owner can see their own delivery log (useful for a "delivery status" UI later).
DROP POLICY IF EXISTS "telegram_log_select_own" ON public.notification_telegram_log;
CREATE POLICY "telegram_log_select_own" ON public.notification_telegram_log
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- DONE
-- Verify with:
--   \d+ public.notification_preferences
--   SELECT user_id, telegram_enabled, telegram_chat_id FROM public.notification_preferences LIMIT 5;
-- ============================================================================
