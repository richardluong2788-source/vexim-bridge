-- ============================================================================
-- Notification system (in-app + email) — FIXED version of 005
--
-- Why this supersedes 005:
--   * 005 referenced `public.get_user_role(uuid)`, which does not exist.
--     The actual helper introduced in 003 is `public.get_current_user_role()`
--     (no argument — uses auth.uid() internally).
--   * 005 therefore failed and rolled back: none of its tables/columns exist.
--     This file recreates everything correctly and idempotently.
--
-- What this file creates:
--   * profiles.preferred_language       — drives email language (vi|en)
--   * notifications                     — in-app feed (bell icon)
--   * notification_preferences          — per-user toggles + unsubscribe token
--   * notification_email_log            — idempotency ledger for Resend sends
--   * RLS: owner can read/update their own rows; admins see everything
-- ============================================================================

-- 1) Preferred language on profiles -------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text
    NOT NULL DEFAULT 'vi'
    CHECK (preferred_language IN ('vi', 'en'));

-- 2) Notifications (in-app) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category       text NOT NULL CHECK (category IN (
    'action_required',   -- client must do something
    'status_update',     -- stage / next_step changed
    'deal_closed',       -- won or lost
    'new_assignment',    -- new lead assigned to client
    'system'             -- fallback (role changes, etc.)
  )),
  title          text NOT NULL,
  body           text,
  link_path      text,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

-- 3) Notification preferences -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id               uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled         boolean NOT NULL DEFAULT true,
  email_action_required boolean NOT NULL DEFAULT true,
  email_status_update   boolean NOT NULL DEFAULT true,
  email_deal_closed     boolean NOT NULL DEFAULT true,
  email_new_assignment  boolean NOT NULL DEFAULT true,
  -- Opaque token used in the `/unsubscribe/<token>` magic link in emails.
  -- Letting users opt out without logging in is required by most ESPs.
  unsubscribe_token     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_token
  ON public.notification_preferences(unsubscribe_token);

-- Seed prefs for every existing profile
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create a prefs row whenever a new profile is created
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

-- Bump updated_at when prefs change
CREATE OR REPLACE FUNCTION public.handle_notification_prefs_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated ON public.notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.handle_notification_prefs_updated();

-- 4) Email delivery log (idempotency) -----------------------------------------
-- One row per (user_id, dedup_key). A unique index prevents double-sends even
-- if an action is retried. The dispatcher inserts BEFORE calling Resend and
-- rolls back to 'failed' if the provider rejects the send.
CREATE TABLE IF NOT EXISTS public.notification_email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dedup_key   text NOT NULL,
  provider_id text,
  status      text NOT NULL DEFAULT 'sent'
                CHECK (status IN ('sent','failed','skipped')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_log_user_dedup
  ON public.notification_email_log(user_id, dedup_key);

-- 5) RLS ----------------------------------------------------------------------
ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_email_log    ENABLE ROW LEVEL SECURITY;

-- notifications: owner reads & marks read; writes are done by the service role
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_preferences: owner reads & updates their own row
DROP POLICY IF EXISTS "pref_select_own" ON public.notification_preferences;
CREATE POLICY "pref_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pref_update_own" ON public.notification_preferences;
CREATE POLICY "pref_update_own" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins / staff see everything (uses the helper from migration 003)
DROP POLICY IF EXISTS "notif_admin_all" ON public.notifications;
CREATE POLICY "notif_admin_all" ON public.notifications
  FOR ALL
  USING (public.get_current_user_role() IN ('admin','staff','super_admin'))
  WITH CHECK (public.get_current_user_role() IN ('admin','staff','super_admin'));

DROP POLICY IF EXISTS "pref_admin_all" ON public.notification_preferences;
CREATE POLICY "pref_admin_all" ON public.notification_preferences
  FOR ALL
  USING (public.get_current_user_role() IN ('admin','staff','super_admin'))
  WITH CHECK (public.get_current_user_role() IN ('admin','staff','super_admin'));

DROP POLICY IF EXISTS "email_log_admin_all" ON public.notification_email_log;
CREATE POLICY "email_log_admin_all" ON public.notification_email_log
  FOR ALL
  USING (public.get_current_user_role() IN ('admin','staff','super_admin'))
  WITH CHECK (public.get_current_user_role() IN ('admin','staff','super_admin'));

-- ============================================================================
-- DONE
-- Verify with:
--   SELECT id, preferred_language FROM public.profiles LIMIT 5;
--   SELECT count(*) FROM public.notification_preferences;
--   \d+ public.notifications
-- ============================================================================
