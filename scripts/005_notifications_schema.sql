-- ============================================================================
-- Notification system (in-app + email)
--
-- Design notes:
--   * `notifications` holds in-app notifications (bell icon feed). One row per
--     (user, event). We keep the row forever so users can scroll history.
--   * `notification_preferences` is 1:1 with profiles and lets users opt out of
--     specific channels/categories. Defaults are "all on".
--   * `notification_email_log` is an idempotency ledger. We write one row per
--     (user, dedup_key) BEFORE sending. A unique index prevents duplicate sends
--     even if an action is retried.
--   * `profiles.preferred_language` drives the locale of outgoing emails.
-- ============================================================================

-- 1) Preferred language on profiles --------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text
    NOT NULL DEFAULT 'vi'
    CHECK (preferred_language IN ('vi', 'en'));

-- 2) Notifications (in-app) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- category drives icon/colour in UI and which preference toggle controls it
  category    text NOT NULL CHECK (category IN (
    'action_required',   -- client must do something
    'status_update',     -- stage / next_step changed
    'deal_closed',       -- won or lost
    'new_assignment',    -- lead assigned to client
    'system'             -- fallback
  )),
  title       text NOT NULL,
  body        text,
  -- Link the user should be sent to when they click
  link_path   text,
  -- Optional correlation with an opportunity for deep-linking
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

-- 3) Notification preferences -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id              uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled        boolean NOT NULL DEFAULT true,
  email_action_required boolean NOT NULL DEFAULT true,
  email_status_update  boolean NOT NULL DEFAULT true,
  email_deal_closed    boolean NOT NULL DEFAULT true,
  email_new_assignment boolean NOT NULL DEFAULT true,
  -- Unsubscribe token lets the user opt out from a one-click link in emails,
  -- without needing to log in. Rotated on any preference change for safety.
  unsubscribe_token    uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Seed prefs for every existing profile
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create prefs row whenever a new profile is created
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences(user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_notification_prefs ON public.profiles;
CREATE TRIGGER trg_create_default_notification_prefs
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_prefs();

-- 4) Email delivery log (idempotency) -----------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dedup_key   text NOT NULL,
  provider_id text, -- resend message id
  status      text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_log_user_dedup
  ON public.notification_email_log(user_id, dedup_key);

-- 5) RLS ----------------------------------------------------------------------
ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_email_log    ENABLE ROW LEVEL SECURITY;

-- notifications: owner can read & mark read; only service role writes (via admin client)
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_preferences: owner can read & update their own row
DROP POLICY IF EXISTS "pref_select_own" ON public.notification_preferences;
CREATE POLICY "pref_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pref_update_own" ON public.notification_preferences;
CREATE POLICY "pref_update_own" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins see everything
DROP POLICY IF EXISTS "notif_admin_all" ON public.notifications;
CREATE POLICY "notif_admin_all" ON public.notifications
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "pref_admin_all" ON public.notification_preferences;
CREATE POLICY "pref_admin_all" ON public.notification_preferences
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "email_log_admin_all" ON public.notification_email_log;
CREATE POLICY "email_log_admin_all" ON public.notification_email_log
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
