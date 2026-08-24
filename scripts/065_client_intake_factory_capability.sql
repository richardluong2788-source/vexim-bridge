-- ============================================================
-- 065: Client Intake — Factory Capability Assessment fields
-- Description: Extends client_intake_submissions with the full factory
--   capability assessment (internal Vexim form mục 6–15) so the client
--   can fill it directly in the public intake wizard (there it's
--   presented renumbered as steps 1–10, since mục 1–5 are the
--   registration fields already covered by the earlier intake step).
--   On AE approval these are mirrored into `client_factory_assessments`
--   (see 046/058) so the internal assessment + score start pre-filled.
-- Date: 2026-08-24
-- ============================================================

-- 1. Add factory capability columns
-- ============================================================

ALTER TABLE client_intake_submissions
    -- 1 (muc 6): He thong quan ly chat luong & ATTP
    ADD COLUMN IF NOT EXISTS quality_systems TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS quality_systems_other TEXT,

    -- 2 (muc 7): Nang luc OEM/ODM + quy mo
    ADD COLUMN IF NOT EXISTS oem_odm TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS company_scale TEXT,

    -- 3 (muc 8): Kinh nghiem xuat khau
    ADD COLUMN IF NOT EXISTS export_since_year INTEGER,
    ADD COLUMN IF NOT EXISTS export_markets TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS export_markets_other TEXT,

    -- 4 (muc 9): Truy xuat nguon goc
    ADD COLUMN IF NOT EXISTS traceability TEXT[] DEFAULT '{}',

    -- 5 (muc 10): Dang ky FDA
    ADD COLUMN IF NOT EXISTS fda_status TEXT CHECK (fda_status IN ('valid', 'expired', 'none')),
    ADD COLUMN IF NOT EXISTS fda_number TEXT,
    ADD COLUMN IF NOT EXISTS fda_expires_at DATE,

    -- 6 (muc 11): Nhan su, gio lam viec & rui ro lao dong / moi truong
    ADD COLUMN IF NOT EXISTS staff_engineers_count INTEGER,
    ADD COLUMN IF NOT EXISTS staff_workers_count INTEGER,
    ADD COLUMN IF NOT EXISTS work_hours_start TEXT,
    ADD COLUMN IF NOT EXISTS work_hours_end TEXT,
    ADD COLUMN IF NOT EXISTS work_days_per_week INTEGER,
    ADD COLUMN IF NOT EXISTS food_safety_training_regular BOOLEAN,
    ADD COLUMN IF NOT EXISTS equipment_calibration_regular BOOLEAN,
    ADD COLUMN IF NOT EXISTS water_source TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS water_source_other TEXT,
    ADD COLUMN IF NOT EXISTS water_testing BOOLEAN,
    ADD COLUMN IF NOT EXISTS near_pollution_source BOOLEAN,
    ADD COLUMN IF NOT EXISTS pollution_source_note TEXT,

    -- 7 (muc 12): Kha nang tiep don Buyer Audit
    ADD COLUMN IF NOT EXISTS audit_readiness TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS audit_owner TEXT,

    -- 8 (muc 13): Nang luc thuong mai
    ADD COLUMN IF NOT EXISTS incoterms TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS payment_policy TEXT,
    ADD COLUMN IF NOT EXISTS oem_policy TEXT,
    ADD COLUMN IF NOT EXISTS odm_policy TEXT,

    -- 9 (muc 14): Nhan su phu trach du an
    ADD COLUMN IF NOT EXISTS has_export_dept BOOLEAN,
    ADD COLUMN IF NOT EXISTS has_english_staff BOOLEAN,
    ADD COLUMN IF NOT EXISTS pricing_decision_maker TEXT,

    -- 10 (muc 15): Cam ket trien khai du an
    ADD COLUMN IF NOT EXISTS commitments TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS project_priority TEXT;

COMMENT ON COLUMN client_intake_submissions.quality_systems IS 'Buoc 1 (muc 6 noi bo): HACCP/GMP/ISO22000/SOP/QC/other';
COMMENT ON COLUMN client_intake_submissions.oem_odm IS 'Buoc 2 (muc 7): OEM/ODM/Private Label/none';
COMMENT ON COLUMN client_intake_submissions.export_markets IS 'Buoc 3 (muc 8): US/EU/JP/KR/CN/ASEAN/ME/other';
COMMENT ON COLUMN client_intake_submissions.traceability IS 'Buoc 4 (muc 9): lot/input/finished/recall/batch-lot/none';
COMMENT ON COLUMN client_intake_submissions.fda_status IS 'Buoc 5 (muc 10): valid/expired/none';
COMMENT ON COLUMN client_intake_submissions.audit_readiness IS 'Buoc 7 (muc 12): onsite/online/not-ready';
COMMENT ON COLUMN client_intake_submissions.incoterms IS 'Buoc 8 (muc 13): EXW/FOB/CIF';
COMMENT ON COLUMN client_intake_submissions.commitments IS 'Buoc 10 (muc 15): priority/cooperation/accuracy';

-- 2. RPC: get_intake_submission_by_token (replace — add new columns)
-- ============================================================
-- Return type is changing (more columns), so drop first: Postgres
-- disallows CREATE OR REPLACE FUNCTION when the RETURNS TABLE shape
-- differs from the existing function.

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
    staff_engineers_count INTEGER,
    staff_workers_count INTEGER,
    work_hours_start TEXT,
    work_hours_end TEXT,
    work_days_per_week INTEGER,
    food_safety_training_regular BOOLEAN,
    equipment_calibration_regular BOOLEAN,
    water_source TEXT[],
    water_source_other TEXT,
    water_testing BOOLEAN,
    near_pollution_source BOOLEAN,
    pollution_source_note TEXT,
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
        s.certifications, s.certifications_other,
        s.quality_systems, s.quality_systems_other,
        s.oem_odm, s.company_scale,
        s.export_since_year, s.export_markets, s.export_markets_other,
        s.traceability,
        s.fda_status, s.fda_number, s.fda_expires_at,
        s.staff_engineers_count, s.staff_workers_count,
        s.work_hours_start, s.work_hours_end, s.work_days_per_week,
        s.food_safety_training_regular, s.equipment_calibration_regular,
        s.water_source, s.water_source_other, s.water_testing,
        s.near_pollution_source, s.pollution_source_note,
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

-- 3. RPC: submit_client_intake (replace — persist new columns too)
-- ============================================================
-- Same signature (TEXT, JSONB), so CREATE OR REPLACE is fine here.

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
        staff_engineers_count = COALESCE((p_payload->>'staff_engineers_count')::INTEGER, staff_engineers_count),
        staff_workers_count = COALESCE((p_payload->>'staff_workers_count')::INTEGER, staff_workers_count),
        work_hours_start = COALESCE(p_payload->>'work_hours_start', work_hours_start),
        work_hours_end = COALESCE(p_payload->>'work_hours_end', work_hours_end),
        work_days_per_week = COALESCE((p_payload->>'work_days_per_week')::INTEGER, work_days_per_week),
        food_safety_training_regular = COALESCE((p_payload->>'food_safety_training_regular')::BOOLEAN, food_safety_training_regular),
        equipment_calibration_regular = COALESCE((p_payload->>'equipment_calibration_regular')::BOOLEAN, equipment_calibration_regular),
        water_source = COALESCE(
            (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload->'water_source') x),
            water_source
        ),
        water_source_other = COALESCE(p_payload->>'water_source_other', water_source_other),
        water_testing = COALESCE((p_payload->>'water_testing')::BOOLEAN, water_testing),
        near_pollution_source = COALESCE((p_payload->>'near_pollution_source')::BOOLEAN, near_pollution_source),
        pollution_source_note = COALESCE(p_payload->>'pollution_source_note', pollution_source_note),
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

-- 4. Comments
-- ============================================================

COMMENT ON TABLE client_intake_submissions IS 'Public, token-based intake submissions from prospective clients, pending AE review before account provisioning. Includes full factory capability assessment (mục 6-15, renumbered 1-10 for the client-facing form).';
