-- Adds a personal "work email" per internal user (AE / admin / lead researcher)
-- so buyer-facing outbound emails can be sent from a real, individual address
-- (e.g. "linh@veximtrade.com") instead of a single shared address
-- (trade@veximtrade.com) used by everyone with a rotating display name.
--
-- Why this matters:
--   Gmail/Outlook strip the display name and show only the raw address when
--   the SAME address is repeatedly seen with MANY DIFFERENT display names —
--   which is exactly what happens when every AE sends from trade@veximtrade.com
--   with their own name in the "From" header. Giving each person their own
--   address lets mail providers learn "this address == this person" and keep
--   showing the real name.
--
-- work_email is nullable: existing users without one keep falling back to the
-- shared trade@veximtrade.com sender (see lib/email/mailer.ts).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS work_email text;

-- Case-insensitive uniqueness — two people must never be assigned the same
-- mailbox, since a real Zoho mailbox will be created to match it.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_work_email_unique_idx
  ON profiles (lower(work_email))
  WHERE work_email IS NOT NULL;

COMMENT ON COLUMN profiles.work_email IS
  'Personal sender address for buyer-facing emails (e.g. linh@veximtrade.com). Auto-generated from full_name on invite; a matching mailbox must be created manually in Zoho Mail admin. Falls back to the shared trade@veximtrade.com sender when null.';
