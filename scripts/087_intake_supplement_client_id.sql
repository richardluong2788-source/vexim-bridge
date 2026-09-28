-- 087: Supplement flow – link intake to existing client
-- Adds client_id to track which client the supplement link was generated for
-- Idempotent

ALTER TABLE client_intake_submissions
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_intake_submissions_client_id
    ON client_intake_submissions(client_id);

COMMENT ON COLUMN client_intake_submissions.client_id IS 'If set, this intake is a supplement for an existing client account (AE created account first). On approval, update instead of create.';

-- Update RPC get_intake_submission_by_token to also return client_id and prefill email/company etc already handled, but include client_id for audit
DROP FUNCTION IF EXISTS get_intake_submission_by_token(TEXT);

CREATE OR REPLACE FUNCTION get_intake_submission_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    status TEXT,
    ae_full_name TEXT,
    client_id UUID,
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
    certifications_other TEXT,
    certification_image_urls TEXT[],
    quality_systems TEXT[],
    quality_systems_other TEXT,
    oem_odm TEXT[],
    company_scale TEXT,
    export_since_year INTEGER,
    export_markets TEXT[],
    export_markets_other TEXT,
    traceability TEXT[],
    fda_status TEXT,
    fda_number TEXT,
    fda_expires_at DATE,
    fda_certificate_url TEXT,
    audit_readiness TEXT[],
    audit_owner TEXT,
    incoterms TEXT[],
    payment_policy TEXT,
    oem_policy TEXT,
    odm_policy TEXT,
    has_export_dept BOOLEAN,
    has_english_staff BOOLEAN,
    pricing_decision_maker TEXT,
    commitments TEXT[],
    project_priority TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id, s.status, p.full_name AS ae_full_name,
        s.client_id,
        s.contact_name, s.email, s.phone, s.company_name, s.industries,
        s.country, s.address, s.website, s.tax_code,
        s.tagline, s.company_description, s.main_products,
        s.production_capacity, s.moq, s.lead_time_days, s.usp_points,
        s.logo_url, s.cover_image_url, s.factory_image_urls, s.video_url,
        s.certifications, s.certifications_other, s.certification_image_urls,
        s.quality_systems, s.quality_systems_other,
        s.oem_odm, s.company_scale,
        s.export_since_year, s.export_markets, s.export_markets_other,
        s.traceability,
        s.fda_status, s.fda_number, s.fda_expires_at, s.fda_certificate_url,
        s.audit_readiness, s.audit_owner,
        s.incoterms, s.payment_policy, s.oem_policy, s.odm_policy,
        s.has_export_dept, s.has_english_staff, s.pricing_decision_maker,
        s.commitments, s.project_priority
    FROM client_intake_submissions s
    LEFT JOIN profiles p ON p.id = s.ae_id
    WHERE s.token = p_token
      AND s.status = 'pending'
      AND s.expires_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_intake_submission_by_token(TEXT) TO anon, authenticated;
