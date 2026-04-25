-- Migration 027 — Email Ref Code Lookup
--
-- Adds an RPC function so the API can resolve an email reference code
-- (e.g. "VEX-LA-A3F9C2") back to the matching opportunity.
--
-- Reference code anatomy:
--   VEX-{CLIENT_INITIALS}-{6 hex chars from opportunity uuid}
--
-- The 6 hex chars are the first 6 chars of the opportunity UUID (before any
-- dashes). Collisions are theoretically possible but extremely unlikely for
-- the size of an SME's pipeline (16M combinations).
--
-- This function uses a prefix match on `id::text` so we don't need a
-- generated short-id column. SECURITY DEFINER so it can be called from the
-- API regardless of RLS, but we only return ids — the caller must still pass
-- through normal RLS when fetching the actual opportunity row.

CREATE OR REPLACE FUNCTION public.find_opportunity_by_ref(short_id TEXT)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  stage TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.client_id, o.stage
  FROM public.opportunities o
  WHERE o.id::text ILIKE short_id || '%'
  ORDER BY o.last_updated DESC NULLS LAST
  LIMIT 5;
$$;

-- Allow authenticated users to call it. Row-level visibility of the actual
-- opportunity is still enforced when the caller selects from `opportunities`.
GRANT EXECUTE ON FUNCTION public.find_opportunity_by_ref(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_opportunity_by_ref(TEXT) TO service_role;

COMMENT ON FUNCTION public.find_opportunity_by_ref(TEXT) IS
  'Resolves a 6-hex-char short id (from email reference codes like VEX-LA-A3F9C2) back to the matching opportunity row(s).';
