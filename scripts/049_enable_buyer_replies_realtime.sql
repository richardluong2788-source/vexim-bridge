-- ============================================================================
-- Enable Supabase Realtime for the buyer_replies table
--
-- The Pipeline Kanban board (app/admin/pipeline/page.tsx) computes its
-- "unread reply" badges and "Cần phản hồi" triage strip from buyer_replies,
-- which is written to by the Resend inbound-email webhook
-- (app/api/webhooks/resend/route.ts) the instant a buyer's email arrives.
--
-- Without this migration, that write is real-time on the server but the
-- open Kanban board has no way to know about it — an AE has to manually
-- reload the page to see the new reply. This migration adds buyer_replies
-- to the `supabase_realtime` publication so the board's client-side
-- subscription (see components/admin/kanban-board.tsx) can receive the
-- INSERT event and refresh automatically, mirroring the pattern already
-- used for `notifications` and `client_request_replies` in migration 039.
--
-- Prerequisites:
--   * The buyer_replies table must exist (migration 010)
--   * Supabase project must have Realtime enabled in dashboard settings
--
-- How to verify after running:
--   1. Go to Supabase Dashboard -> Database -> Replication
--   2. Ensure buyer_replies is listed under "Source" for supabase_realtime
--   3. Test by inserting a buyer_replies row and checking if the Pipeline
--      board's "Cần phản hồi" strip / unread badge updates without reload
-- ============================================================================

-- Idempotent: add the table to the realtime publication only if not already added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'buyer_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buyer_replies;
  END IF;
END $$;

-- Full replica identity so Realtime can send complete row data
-- (opportunity_id, from_email, etc.) with each change event.
ALTER TABLE public.buyer_replies REPLICA IDENTITY FULL;

-- ============================================================================
-- DONE
-- The Pipeline Kanban board should now auto-refresh when a buyer reply
-- arrives. If not working, ensure:
--   1. Realtime is enabled in Supabase Dashboard settings
--   2. RLS policies on buyer_replies allow the staff role to SELECT
--      (see "Staff manage buyer replies" policy in migration 010)
--   3. The client-side subscription in kanban-board.tsx is mounted
-- ============================================================================
