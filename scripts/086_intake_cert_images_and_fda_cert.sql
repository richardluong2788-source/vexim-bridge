-- ============================================================
-- 086: Intake - Certification images + FDA certificate URL
-- Description: Adds image upload support for certifications (step 2)
--   and FDA certificate (step 5) in the public intake wizard.
--   - certification_image_urls: array of Blob URLs for HACCP/ISO/etc
--   - fda_certificate_url: single Blob URL for FDA cert scan
--   Also relaxes fda_status CHECK to allow 'in_progress' /
--   'pending_supplement' to match the system-wide FDA handling
--   (see 081_fda_pending_supplement_and_ae_sourcing.sql).
-- Date: 2026-09-24
-- Idempotent
-- ============================================================

-- 1. Add new columns to client_intake_submissions
ALTER TABLE client_intake_submissions
    ADD COLUMN IF NOT EXISTS certification_image_urls TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS fda_certificate_url TEXT;

COMMENT ON COLUMN client_intake_submissions.certification_image_urls IS 'Step 2: array of Blob URLs for certification scans (HACCP, ISO, Halal, etc) – shown on public profile';
COMMENT ON COLUMN client_intake_submissions.fda_certificate_url IS 'Step 5: Blob URL for FDA registration certificate scan – mapped to profiles.fda_* and compliance_docs';

-- 2. Relax fda_status check to include in_progress / pending_supplement
ALTER TABLE client_intake_submissions DROP CONSTRAINT IF EXISTS client_intake_submissions_fda_status_check;

ALTER TABLE client_intake_submissions
    ADD CONSTRAINT client_intake_submissions_fda_status_check
    CHECK (fda_status IN ('valid', 'expired', 'in_progress', 'pending_supplement', 'none'));

-- 3. Also add fda_certificate_url to client_factory_assessments for internal mirror (optional, for AE review)
ALTER TABLE client_factory_assessments
    ADD COLUMN IF NOT EXISTS fda_certificate_url TEXT;

COMMENT ON COLUMN client_factory_assessments.fda_certificate_url IS 'FDA certificate image URL from intake – mirrored to compliance_docs on approval';

-- 4. Recreate RPC: get_intake_submission_by_token (add new columns)
DROP FUNCTION IF EXISTS get_intake_submission_by_token(TEXT);

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

-- 5. Recreate RPC: submit_client_intake (persist new columns)
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
        certification_image_urls = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'certification_image_urls') x),
            certification_image_urls
        ),

        quality_systems = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'quality_systems') x),
            quality_systems
        ),
        quality_systems_other = COALESCE(p_payload->>'quality_systems_other', quality_systems_other),
        oem_odm = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'oem_odm') x),
            oem_odm
        ),
        company_scale = COALESCE(p_payload->>'company_scale', company_scale),
        export_since_year = COALESCE((p_payload->>'export_since_year')::INTEGER, export_since_year),
        export_markets = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'export_markets') x),
            export_markets
        ),
        export_markets_other = COALESCE(p_payload->>'export_markets_other', export_markets_other),
        traceability = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'traceability') x),
            traceability
        ),
        fda_status = COALESCE(p_payload->>'fda_status', fda_status),
        fda_number = COALESCE(p_payload->>'fda_number', fda_number),
        fda_expires_at = COALESCE((p_payload->>'fda_expires_at')::DATE, fda_expires_at),
        fda_certificate_url = COALESCE(p_payload->>'fda_certificate_url', fda_certificate_url),
        audit_readiness = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'audit_readiness') x),
            audit_readiness
        ),
        audit_owner = COALESCE(p_payload->>'audit_owner', audit_owner),
        incoterms = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'incoterms') x),
            incoterms
        ),
        payment_policy = COALESCE(p_payload->>'payment_policy', payment_policy),
        oem_policy = COALESCE(p_payload->>'oem_policy', oem_policy),
        odm_policy = COALESCE(p_payload->>'odm_policy', odm_policy),
        has_export_dept = COALESCE((p_payload->>'has_export_dept')::BOOLEAN, has_export_dept),
        has_english_staff = COALESCE((p_payload->>'has_english_staff')::BOOLEAN, has_english_staff),
        pricing_decision_maker = COALESCE(p_payload->>'pricing_decision_maker', pricing_decision_maker),
        commitments = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'commitments') x),
            commitments
        ),
        project_priority = COALESCE(p_payload->>'project_priority', project_priority),

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
