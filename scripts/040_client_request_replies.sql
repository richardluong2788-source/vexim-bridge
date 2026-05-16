-- =====================================================================
-- Migration 040 — Client Request Replies/Comments
-- =====================================================================
-- Purpose: Allow multiple back-and-forth replies between admin and client
-- on a single client_request, creating a conversation thread.
--
-- New table: client_request_replies
--   - Each row is one message in the thread
--   - client_id can reply (status='by_client')
--   - admin/staff can reply (status='by_admin')
--   - Timestamps track when each reply was posted
-- =====================================================================

-- Create the replies table
CREATE TABLE IF NOT EXISTS public.client_request_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_request_id UUID NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
  
  -- Who sent this reply
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin', 'staff')),
  
  -- The reply message
  body TEXT NOT NULL,
  
  -- Read status for the recipient
  read_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for quick access
CREATE INDEX IF NOT EXISTS idx_client_request_replies_request
  ON public.client_request_replies(client_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_request_replies_unread
  ON public.client_request_replies(client_request_id)
  WHERE read_at IS NULL;

-- RLS: Allow clients to see only their own requests' replies
ALTER TABLE public.client_request_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_view_own_request_replies" ON public.client_request_replies;
CREATE POLICY "clients_view_own_request_replies"
  ON public.client_request_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_requests cr
      WHERE cr.id = client_request_id
      AND cr.client_id = auth.uid()
    )
    OR
    -- Admin/staff can view all
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "clients_insert_own_request_replies" ON public.client_request_replies;
CREATE POLICY "clients_insert_own_request_replies"
  ON public.client_request_replies
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM public.client_requests cr
      WHERE cr.id = client_request_id
      AND cr.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff_manage_request_replies" ON public.client_request_replies;
CREATE POLICY "staff_manage_request_replies"
  ON public.client_request_replies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin', 'staff')
    )
  );

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_client_request_replies_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_client_request_replies_update ON public.client_request_replies;
CREATE TRIGGER on_client_request_replies_update
  BEFORE UPDATE ON public.client_request_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_request_replies_timestamp();

-- Idempotent — safe to re-run
