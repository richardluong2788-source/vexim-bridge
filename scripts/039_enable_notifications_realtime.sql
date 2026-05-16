-- ============================================================================
-- Enable Supabase Realtime for notifications and client_request_replies tables
--
-- This migration enables realtime subscriptions for the notifications table
-- and client_request_replies table. 
-- 
-- The notification bell uses Supabase Realtime to show instant updates
-- when new notifications arrive (both for admin and client portals).
-- 
-- Client request replies use Realtime to show live conversation threads
-- as admin and client exchange messages.
--
-- Prerequisites:
--   * The notifications and client_request_replies tables must exist
--   * Supabase project must have Realtime enabled in dashboard settings
--
-- How to verify after running:
--   1. Go to Supabase Dashboard -> Database -> Replication
--   2. Ensure both tables are listed under "Source" for supabase_realtime
--   3. Test by inserting a notification and checking if the bell updates
-- ============================================================================

-- Add notifications table to the supabase_realtime publication
-- This allows clients to subscribe to INSERT/UPDATE/DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Set replica identity to FULL so Realtime can send the full row data
-- (needed for proper filtering by user_id in subscriptions)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add client_request_replies table to the supabase_realtime publication
-- This allows clients and admins to see live conversation threads
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_request_replies;
ALTER TABLE public.client_request_replies REPLICA IDENTITY FULL;

-- ============================================================================
-- DONE
-- The notification bell and client request replies should now work with
-- realtime updates. If not working, ensure:
--   1. Realtime is enabled in Supabase Dashboard settings
--   2. RLS policies allow the user to SELECT from these tables
--   3. The subscription filters match correctly
-- ============================================================================
