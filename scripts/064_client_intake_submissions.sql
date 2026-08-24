-- ============================================================
-- 064: Client Intake Submissions
-- Description: Public, token-based intake form for prospective clients.
--   An AE generates a single-use link (no login required) and sends it
--   to a prospect. The prospect fills registration info + a full
--   capability profile. The submission sits here — fully decoupled from
--   `profiles` / `client_profiles` — until an AE reviews and approves it.
--   On approval, application code provisions the client account
--   (existing `createClientAccount` flow) and mirrors the capability
--   fields into `client_profiles`.
-- Date: 2026-08-24
-- ============================================================

-- 1. Create client_intake_submissions table
-- ============================================================

CREATE TABLE IF NOT EXISTS client_intake_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link / ownership --------------------------------------------------
    token TEXT NOT NULL,
    ae_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),

    -- Registration fields (required — map -> profiles) ------------------
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    industries TEXT[] DEFAULT '{}',

    -- Company info (map -> profiles) -------------------------------------
    country TEXT,
    address TEXT,
    website TEXT,
    tax_code TEXT,

    -- Capability profile (map -> client_profiles) ------------------------
    tagline TEXT,
    company_description TEXT,
    main_products TEXT,
    production_capacity TEXT,
    moq TEXT,
    lead_time_days TEXT,
    usp_points JSONB DEFAULT '[]'::jsonb,
    logo_url TEXT,
    cover_image_url TEXT,
    factory_image_urls TEXT[] DEFAULT '{}',
    video_url TEXT,

    -- Certifications (free-form at intake time) --------------------------
    certifications TEXT[] DEFAULT '{}',
    certifications_other TEXT,

    -- Review metadata -----------------------------------------------------
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,
    created_client_id UUID REFERENCES profiles(id),

    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_client_intake_token UNIQUE (token)
);

-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_client_intake_token ON client_intake_submissions(token);
CREATE INDEX IF NOT EXISTS idx_client_intake_ae_id ON client_intake_submissions(ae_id);
CREATE INDEX IF NOT EXISTS idx_client_intake_status ON client_intake_submissions(status);

-- 3. Enable RLS
-- ============================================================

ALTER TABLE client_intake_submissions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- ============================================================
-- NOTE: anon never gets a raw SELECT/UPDATE policy on this table — the
-- public form only ever talks to it through the two SECURITY DEFINER
-- RPCs below, so a stolen token can only read/act on ITS OWN row and
-- can never enumerate other submissions.

-- AE can see their own generated links + submissions.
CREATE POLICY "client_intake_ae_read_own"
ON client_intake_submissions
FOR SELECT
TO authenticated
USING (ae_id = auth.uid());

-- Admin/Staff/Super Admin can see every submission (oversight / QA).
CREATE POLICY "client_intake_admin_read_all"
ON client_intake_submissions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff')
    )
);

-- AE can create their own intake links.
CREATE POLICY "client_intake_ae_insert_own"
ON client_intake_submissions
FOR INSERT
TO authenticated
WITH CHECK (
    ae_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- AE can update (review/approve/reject) their own submissions.
CREATE POLICY "client_intake_ae_update_own"
ON client_intake_submissions
FOR UPDATE
TO authenticated
USING (ae_id = auth.uid())
WITH CHECK (ae_id = auth.uid());

-- Admin/Staff/Super Admin can update any submission.
CREATE POLICY "client_intake_admin_update_all"
ON client_intake_submissions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff')
    )
);

-- 5. RPC: get_intake_submission_by_token
-- ============================================================
-- Used by the PUBLIC intake page to validate a link and pre-fill the AE
-- name shown in the footer. Only returns a row when it's still open for
-- editing (pending or previously started, not expired). Deliberately
-- returns a narrow column set — no internal review metadata.

CREATE OR REPLACE FUNCTION get_intake_submission_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    status TEXT,
    ae_full_name TEXT,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    industries TEXT[],
    country TEXT,
    address TEXT,
    website TEXT,
    tax_code TEXT,
    tagline TEXT,
    company_description TEXT,
    main_products TEXT,
    production_capacity TEXT,
    moq TEXT,
    lead_time_days TEXT,
    usp_points JSONB,
    logo_url TEXT,
    cover_image_url TEXT,
    factory_image_urls TEXT[],
    video_url TEXT,
    certifications TEXT[],
    certifications_other TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id, s.status, p.full_name AS ae_full_name,
        s.contact_name, s.email, s.phone, s.company_name, s.industries,
        s.country, s.address, s.website, s.tax_code,
        s.tagline, s.company_description, s.main_products,
        s.production_capacity, s.moq, s.lead_time_days, s.usp_points,
        s.logo_url, s.cover_image_url, s.factory_image_urls, s.video_url,
        s.certifications, s.certifications_other
    FROM client_intake_submissions s
    LEFT JOIN profiles p ON p.id = s.ae_id
    WHERE s.token = p_token
      AND s.status = 'pending'
      AND s.expires_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_intake_submission_by_token(TEXT) TO anon, authenticated;

-- 6. RPC: submit_client_intake
-- ============================================================
-- Used by the PUBLIC intake page on final submit. Flips status to
-- 'submitted' so the token can never be reused, and stamps submitted_at.
-- Returns true on success, false if the token was invalid/expired/already
-- used (caller should show a friendly error, never a raw DB error).

CREATE OR REPLACE FUNCTION submit_client_intake(p_token TEXT, p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE client_intake_submissions SET
        contact_name = COALESCE(p_payload->>'contact_name', contact_name),
        email = COALESCE(p_payload->>'email', email),
        phone = COALESCE(p_payload->>'phone', phone),
        company_name = COALESCE(p_payload->>'company_name', company_name),
        industries = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'industries') x),
            industries
        ),
        country = COALESCE(p_payload->>'country', country),
        address = COALESCE(p_payload->>'address', address),
        website = COALESCE(p_payload->>'website', website),
        tax_code = COALESCE(p_payload->>'tax_code', tax_code),
        tagline = COALESCE(p_payload->>'tagline', tagline),
        company_description = COALESCE(p_payload->>'company_description', company_description),
        main_products = COALESCE(p_payload->>'main_products', main_products),
        production_capacity = COALESCE(p_payload->>'production_capacity', production_capacity),
        moq = COALESCE(p_payload->>'moq', moq),
        lead_time_days = COALESCE(p_payload->>'lead_time_days', lead_time_days),
        usp_points = COALESCE(p_payload->'usp_points', usp_points),
        logo_url = COALESCE(p_payload->>'logo_url', logo_url),
        cover_image_url = COALESCE(p_payload->>'cover_image_url', cover_image_url),
        factory_image_urls = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'factory_image_urls') x),
            factory_image_urls
        ),
        video_url = COALESCE(p_payload->>'video_url', video_url),
        certifications = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'certifications') x),
            certifications
        ),
        certifications_other = COALESCE(p_payload->>'certifications_other', certifications_other),
        status = 'submitted',
        submitted_at = now(),
        updated_at = now()
    WHERE token = p_token
      AND status = 'pending'
      AND expires_at > now();

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_client_intake(TEXT, JSONB) TO anon, authenticated;

-- 7. updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_client_intake_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_intake_updated_at ON client_intake_submissions;
CREATE TRIGGER trigger_client_intake_updated_at
    BEFORE UPDATE ON client_intake_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_client_intake_updated_at();

-- 8. Comments
-- ============================================================

COMMENT ON TABLE client_intake_submissions IS 'Public, token-based intake submissions from prospective clients, pending AE review before account provisioning.';
COMMENT ON COLUMN client_intake_submissions.token IS 'Random single-use token embedded in the public URL /client-intake/[token].';
COMMENT ON COLUMN client_intake_submissions.status IS 'pending = link sent, not yet filled; submitted = client filled & sent, awaiting AE review; approved/rejected = AE decision made.';
COMMENT ON COLUMN client_intake_submissions.usp_points IS 'JSON array of USP points: [{ "icon": "Factory", "title": "20+ Years Experience" }] — mirrors client_profiles.usp_points shape.';
COMMENT ON COLUMN client_intake_submissions.created_client_id IS 'Set to the new profiles.id once an AE approves and the account is provisioned.';
