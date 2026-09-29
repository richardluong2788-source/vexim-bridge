-- DESTRUCTIVE: permanently removes every campaign and its campaign-scoped
-- drafts/interactions so the pilot can be rebuilt from a clean slate.
-- It does NOT delete raw buyer_replies or general activities/audit records.
-- Run manually in Supabase SQL Editor after reviewing the consequences.

BEGIN;

CREATE TEMP TABLE _campaign_reset_enrollment_ids ON COMMIT DROP AS
SELECT id
FROM public.campaign_enrollments;

-- Delete campaign drafts (including rejected/QA-blocked/sent campaign drafts).
DELETE FROM public.email_drafts
WHERE campaign_enrollment_id IN (SELECT id FROM _campaign_reset_enrollment_ids);

-- Remove campaign-scoped interaction history so campaign counters restart at 0.
DELETE FROM public.buyer_interactions
WHERE enrollment_id IN (SELECT id FROM _campaign_reset_enrollment_ids)
   OR campaign_id IN (SELECT id FROM public.campaigns);

-- Campaign steps and enrollments cascade from campaigns; firing locks cascade
-- from enrollments. Delete all campaign definitions in one transaction.
DELETE FROM public.campaigns;

COMMIT;
