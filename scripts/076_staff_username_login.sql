-- ============================================================
-- Migration 076: Staff username login
-- ============================================================
-- Internal staff accounts are now created directly by a super admin
-- (or admin) with a username + password — no invite email, no
-- self-set-password step. Clients (suppliers) keep the email flow.
--
-- Supabase Auth still keys accounts by email, so a username-based
-- staff account carries a synthetic email
-- `<username>@staff.veximtrade.com` (see lib/auth/staff-login.ts).
-- `profiles.username` is the human-facing login name and the unique
-- key the login screen resolves. It is NULL for client accounts and
-- for legacy staff who signed up via the old email-invite flow (they
-- keep signing in with their real email).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Case-insensitive uniqueness; multiple NULLs are allowed (clients and
-- legacy accounts without a username).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- Format guard, mirrored by USERNAME_PATTERN in lib/auth/staff-login.ts:
-- 3–30 chars, lowercase letters/numbers/dot/underscore/hyphen, must
-- start and end with a letter or number.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (
    username IS NULL
    OR username ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'
  );

COMMENT ON COLUMN public.profiles.username IS
  'Login username for super-admin-provisioned staff accounts (migration 076). NULL for clients and legacy email-invited staff.';

-- ============================================================
-- Heal staff accounts created before the confirmation hardening.
-- These were provisioned with a synthetic staff email and an admin
-- password, but an unconfirmed auth row blocks sign-in with
-- "Email not confirmed". Confirm every such account now.
-- ============================================================
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmation_token = '',
  confirmation_sent_at = NULL,
  recovery_token = COALESCE(recovery_token, ''),
  updated_at = NOW()
WHERE email LIKE '%@staff.veximtrade.com'
  AND email_confirmed_at IS NULL;
