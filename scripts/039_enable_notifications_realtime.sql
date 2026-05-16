-- ============================================================================
-- Enable Supabase Realtime for notifications table
--
-- This migration enables realtime subscriptions for the notifications table.
-- The notification bell uses Supabase Realtime to show instant updates
-- when new notifications arrive (both for admin and client portals).
--
-- Prerequisites:
--   * The notifications table must exist (created in 006_notifications_schema_fix.sql)
--   * Supabase project must have Realtime enabled in dashboard settings
--
-- How to verify after running:
--   1. Go to Supabase Dashboard -> Database -> Replication
--   2. Ensure 'notifications' table is listed under "Source" for supabase_realtime
--   3. Test by inserting a notification and checking if the bell updates
-- ============================================================================

-- Add notifications table to the supabase_realtime publication
-- This allows clients to subscribe to INSERT/UPDATE/DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Set replica identity to FULL so Realtime can send the full row data
-- (needed for proper filtering by user_id in subscriptions)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================================================
-- DONE
-- The notification bell should now receive instant updates via Realtime.
-- If not working, ensure:
--   1. Realtime is enabled in Supabase Dashboard settings
--   2. RLS policies allow the user to SELECT their own notifications
--   3. The subscription filter (user_id=eq.{userId}) matches correctly
-- ============================================================================
