-- ============================================================
-- 101: Supplier sourcing + U.S. channel intake
--
-- Keeps supplier legal identity separate from internal factory/source
-- locations. Facility details and verification records are never copied to
-- client_profiles/public company addresses. FDA columns are intentionally
-- left in place for legacy records, but the initial supplier intake RPC no
-- longer reads or writes them.
-- ============================================================

-- Internal account-level sourcing and market-fit fields.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS supplier_entity_type TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS source_verification_status TEXT NOT NULL DEFAULT 'not_assessed',
    ADD COLUMN IF NOT EXISTS source_verification_consent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS source_change_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS us_sales_channel_status TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS us_sales_channel_notes TEXT,
    ADD COLUMN IF NOT EXISTS vexim_support_needs TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS vexim_support_other TEXT;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_supplier_entity_type_check,
    DROP CONSTRAINT IF EXISTS profiles_source_verification_status_check,
    DROP CONSTRAINT IF EXISTS profiles_us_sales_channel_status_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_supplier_entity_type_check
        CHECK (supplier_entity_type IN (
            'direct_manufacturer', 'manufacturer_group', 'trading_company',
            'authorized_representative', 'other', 'unknown'
        )),
    ADD CONSTRAINT profiles_source_verification_status_check
        CHECK (source_verification_status IN (
            'not_assessed', 'awaiting_details', 'pending_verification', 'verified', 'on_hold'
        )),
    ADD CONSTRAINT profiles_us_sales_channel_status_check
        CHECK (us_sales_channel_status IN ('yes', 'no', 'in_progress', 'unknown'));

COMMENT ON COLUMN public.profiles.supplier_entity_type IS 'Internal supplier role classification; not part of the public supplier profile.';
COMMENT ON COLUMN public.profiles.source_verification_status IS 'Internal status of the supplier manufacturing-source review.';
COMMENT ON COLUMN public.profiles.source_verification_consent IS 'Supplier consent to Vexim contacting/manually verifying manufacturing sources.';
COMMENT ON COLUMN public.profiles.source_change_acknowledged IS 'Supplier acknowledgement to notify Vexim before changing an introduced manufacturing source.';
COMMENT ON COLUMN public.profiles.us_sales_channel_status IS 'Supplier-reported status of current U.S. buyers or sales channels; informational only, never an automatic rejection criterion.';
COMMENT ON COLUMN public.profiles.vexim_support_needs IS 'Supplier-selected types of U.S. market-entry support requested from Vexim.';

-- The token-based intake row stores supplier-provided details plus internal
-- review decisions. Public token RPCs return only the supplier-provided keys.
ALTER TABLE public.client_intake_submissions
    ADD COLUMN IF NOT EXISTS supplier_entity_type TEXT,
    ADD COLUMN IF NOT EXISTS manufacturing_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source_verification_status TEXT NOT NULL DEFAULT 'awaiting_details',
    ADD COLUMN IF NOT EXISTS source_verification_consent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS source_change_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS us_sales_channel_status TEXT,
    ADD COLUMN IF NOT EXISTS us_sales_channel_notes TEXT,
    ADD COLUMN IF NOT EXISTS vexim_support_needs TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS vexim_support_other TEXT;

ALTER TABLE public.client_intake_submissions
    DROP CONSTRAINT IF EXISTS client_intake_submissions_supplier_entity_type_check,
    DROP CONSTRAINT IF EXISTS client_intake_submissions_source_verification_status_check,
    DROP CONSTRAINT IF EXISTS client_intake_submissions_us_sales_channel_status_check;

ALTER TABLE public.client_intake_submissions
    ADD CONSTRAINT client_intake_submissions_supplier_entity_type_check
        CHECK (supplier_entity_type IS NULL OR supplier_entity_type IN (
            'direct_manufacturer', 'manufacturer_group', 'trading_company',
            'authorized_representative', 'other', 'unknown'
        )),
    ADD CONSTRAINT client_intake_submissions_source_verification_status_check
        CHECK (source_verification_status IN (
            'not_assessed', 'awaiting_details', 'pending_verification', 'verified', 'on_hold'
        )),
    ADD CONSTRAINT client_intake_submissions_us_sales_channel_status_check
        CHECK (us_sales_channel_status IS NULL OR us_sales_channel_status IN ('yes', 'no', 'in_progress', 'unknown'));

COMMENT ON COLUMN public.client_intake_submissions.manufacturing_sources IS 'Supplier-provided internal source facilities and products, plus reviewer-only verification fields. Never mapped to the public company address.';
COMMENT ON COLUMN public.client_intake_submissions.source_verification_status IS 'Internal pipeline status. A supplier submission is never treated as verified automatically.';
COMMENT ON COLUMN public.client_intake_submissions.us_sales_channel_status IS 'Supplier-reported U.S. buyer/channel status; must not be used to automatically reject a supplier.';

-- Normalized, internal-only source-of-manufacture records. Product names are
-- the source-level link until the client product catalog has a confirmed SKU.
CREATE TABLE IF NOT EXISTS public.client_manufacturing_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    intake_submission_id UUID REFERENCES public.client_intake_submissions(id) ON DELETE SET NULL,
    source_index SMALLINT,
    facility_name TEXT,
    facility_address TEXT,
    product_names TEXT[] NOT NULL DEFAULT '{}',
    relationship_type TEXT,
    relationship_notes TEXT,
    verification_contact_name TEXT,
    verification_contact_email TEXT,
    verification_contact_phone TEXT,
    evidence_note TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending_verification',
    verification_notes TEXT,
    verification_consent BOOLEAN NOT NULL DEFAULT FALSE,
    source_change_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT client_manufacturing_sources_relationship_check
        CHECK (relationship_type IS NULL OR relationship_type IN (
            'direct_manufacturer', 'group_affiliate', 'contract_manufacturer',
            'authorized_representative', 'trading_company', 'other'
        )),
    CONSTRAINT client_manufacturing_sources_verification_check
        CHECK (verification_status IN ('pending_verification', 'verified', 'needs_follow_up')),
    CONSTRAINT client_manufacturing_sources_verified_notes_check
        CHECK (verification_status <> 'verified' OR length(btrim(COALESCE(verification_notes, ''))) > 0),
    CONSTRAINT client_manufacturing_sources_intake_index_unique
        UNIQUE (intake_submission_id, source_index)
);

CREATE INDEX IF NOT EXISTS idx_client_manufacturing_sources_client_id
    ON public.client_manufacturing_sources(client_id);
CREATE INDEX IF NOT EXISTS idx_client_manufacturing_sources_verification_status
    ON public.client_manufacturing_sources(verification_status);

COMMENT ON TABLE public.client_manufacturing_sources IS 'Internal-only source facilities for supplier accounts. Facility addresses and verification details are not public profile data.';
COMMENT ON COLUMN public.client_manufacturing_sources.facility_address IS 'Internal factory/source address for Vexim verification only; never map to profiles.address or client_profiles.';
COMMENT ON COLUMN public.client_manufacturing_sources.product_names IS 'Products reported as manufactured at this particular source facility.';
COMMENT ON COLUMN public.client_manufacturing_sources.evidence_note IS 'Supplier-reported evidence type or availability; not independently verified until a reviewer records that status.';

ALTER TABLE public.client_manufacturing_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_manufacturing_sources_internal_access" ON public.client_manufacturing_sources;
CREATE POLICY "client_manufacturing_sources_internal_access"
    ON public.client_manufacturing_sources
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive', 'supplier_researcher')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive', 'supplier_researcher')
        )
    );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_manufacturing_sources TO authenticated;

CREATE OR REPLACE FUNCTION public.update_client_manufacturing_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_manufacturing_sources_updated_at ON public.client_manufacturing_sources;
CREATE TRIGGER trigger_client_manufacturing_sources_updated_at
    BEFORE UPDATE ON public.client_manufacturing_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_client_manufacturing_sources_updated_at();

-- The public link can prefill supplier-facing information, but cannot read
-- internal verification status, reviewer notes, or FDA legacy fields.
DROP FUNCTION IF EXISTS public.get_intake_submission_by_token(TEXT);
CREATE FUNCTION public.get_intake_submission_by_token(p_token TEXT)
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
    project_priority TEXT,
    supplier_entity_type TEXT,
    manufacturing_sources JSONB,
    source_verification_consent BOOLEAN,
    source_change_acknowledged BOOLEAN,
    us_sales_channel_status TEXT,
    us_sales_channel_notes TEXT,
    vexim_support_needs TEXT[],
    vexim_support_other TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id, s.status, p.full_name AS ae_full_name, s.client_id,
        s.contact_name, s.email, s.phone, s.company_name, s.industries,
        s.country, s.address, s.website, s.tax_code,
        s.tagline, s.company_description, s.main_products,
        s.production_capacity, s.moq, s.lead_time_days, s.usp_points,
        s.logo_url, s.cover_image_url, s.factory_image_urls, s.video_url,
        s.certifications, s.certifications_other, s.certification_image_urls,
        s.quality_systems, s.quality_systems_other, s.oem_odm,
        s.company_scale, s.export_since_year, s.export_markets,
        s.export_markets_other, s.traceability,
        s.audit_readiness, s.audit_owner, s.incoterms,
        s.payment_policy, s.oem_policy, s.odm_policy,
        s.has_export_dept, s.has_english_staff, s.pricing_decision_maker,
        s.commitments, s.project_priority, s.supplier_entity_type,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_strip_nulls(jsonb_build_object(
                        'facility_name', source.value -> 'facility_name',
                        'facility_address', source.value -> 'facility_address',
                        'product_names', source.value -> 'product_names',
                        'relationship_type', source.value -> 'relationship_type',
                        'relationship_notes', source.value -> 'relationship_notes',
                        'verification_contact_name', source.value -> 'verification_contact_name',
                        'verification_contact_email', source.value -> 'verification_contact_email',
                        'verification_contact_phone', source.value -> 'verification_contact_phone',
                        'evidence_note', source.value -> 'evidence_note'
                    )) ORDER BY source.ordinality
                )
                FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(s.manufacturing_sources) = 'array'
                        THEN s.manufacturing_sources ELSE '[]'::jsonb END
                ) WITH ORDINALITY AS source(value, ordinality)
            ),
            '[]'::jsonb
        ) AS manufacturing_sources,
        s.source_verification_consent, s.source_change_acknowledged,
        s.us_sales_channel_status, s.us_sales_channel_notes,
        s.vexim_support_needs, s.vexim_support_other
    FROM public.client_intake_submissions s
    LEFT JOIN public.profiles p ON p.id = s.ae_id
    WHERE s.token = p_token
      AND s.status = 'pending'
      AND s.expires_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_intake_submission_by_token(TEXT) TO anon, authenticated;

-- Persist supplier answers while keeping FDA legacy columns untouched.
CREATE OR REPLACE FUNCTION public.submit_client_intake(p_token TEXT, p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.client_intake_submissions SET
        contact_name = COALESCE(p_payload->>'contact_name', contact_name),
        email = COALESCE(p_payload->>'email', email),
        phone = COALESCE(p_payload->>'phone', phone),
        company_name = COALESCE(p_payload->>'company_name', company_name),
        industries = CASE
            WHEN jsonb_typeof(p_payload->'industries') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'industries'))
            ELSE industries
        END,
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
        factory_image_urls = CASE
            WHEN jsonb_typeof(p_payload->'factory_image_urls') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'factory_image_urls'))
            ELSE factory_image_urls
        END,
        video_url = COALESCE(p_payload->>'video_url', video_url),
        certifications = CASE
            WHEN jsonb_typeof(p_payload->'certifications') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'certifications'))
            ELSE certifications
        END,
        certifications_other = COALESCE(p_payload->>'certifications_other', certifications_other),
        certification_image_urls = CASE
            WHEN jsonb_typeof(p_payload->'certification_image_urls') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'certification_image_urls'))
            ELSE certification_image_urls
        END,
        quality_systems = CASE
            WHEN jsonb_typeof(p_payload->'quality_systems') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'quality_systems'))
            ELSE quality_systems
        END,
        quality_systems_other = COALESCE(p_payload->>'quality_systems_other', quality_systems_other),
        oem_odm = CASE
            WHEN jsonb_typeof(p_payload->'oem_odm') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'oem_odm'))
            ELSE oem_odm
        END,
        company_scale = COALESCE(p_payload->>'company_scale', company_scale),
        export_since_year = COALESCE((p_payload->>'export_since_year')::INTEGER, export_since_year),
        export_markets = CASE
            WHEN jsonb_typeof(p_payload->'export_markets') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'export_markets'))
            ELSE export_markets
        END,
        export_markets_other = COALESCE(p_payload->>'export_markets_other', export_markets_other),
        traceability = CASE
            WHEN jsonb_typeof(p_payload->'traceability') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'traceability'))
            ELSE traceability
        END,
        audit_readiness = CASE
            WHEN jsonb_typeof(p_payload->'audit_readiness') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'audit_readiness'))
            ELSE audit_readiness
        END,
        audit_owner = COALESCE(p_payload->>'audit_owner', audit_owner),
        incoterms = CASE
            WHEN jsonb_typeof(p_payload->'incoterms') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'incoterms'))
            ELSE incoterms
        END,
        payment_policy = COALESCE(p_payload->>'payment_policy', payment_policy),
        oem_policy = COALESCE(p_payload->>'oem_policy', oem_policy),
        odm_policy = COALESCE(p_payload->>'odm_policy', odm_policy),
        has_export_dept = COALESCE((p_payload->>'has_export_dept')::BOOLEAN, has_export_dept),
        has_english_staff = COALESCE((p_payload->>'has_english_staff')::BOOLEAN, has_english_staff),
        pricing_decision_maker = COALESCE(p_payload->>'pricing_decision_maker', pricing_decision_maker),
        commitments = CASE
            WHEN jsonb_typeof(p_payload->'commitments') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'commitments'))
            ELSE commitments
        END,
        project_priority = COALESCE(p_payload->>'project_priority', project_priority),
        supplier_entity_type = CASE
            WHEN p_payload->>'supplier_entity_type' IN (
                'direct_manufacturer', 'manufacturer_group', 'trading_company',
                'authorized_representative', 'other', 'unknown'
            ) THEN p_payload->>'supplier_entity_type'
            ELSE supplier_entity_type
        END,
        manufacturing_sources = CASE
            WHEN jsonb_typeof(p_payload->'manufacturing_sources') = 'array'
                THEN (
                    SELECT COALESCE(
                        jsonb_agg(
                            jsonb_strip_nulls(jsonb_build_object(
                                'facility_name', source.value -> 'facility_name',
                                'facility_address', source.value -> 'facility_address',
                                'product_names', source.value -> 'product_names',
                                'relationship_type', source.value -> 'relationship_type',
                                'relationship_notes', source.value -> 'relationship_notes',
                                'verification_contact_name', source.value -> 'verification_contact_name',
                                'verification_contact_email', source.value -> 'verification_contact_email',
                                'verification_contact_phone', source.value -> 'verification_contact_phone',
                                'evidence_note', source.value -> 'evidence_note',
                                'verification_status', to_jsonb('pending_verification'::TEXT),
                                'verification_notes', to_jsonb(''::TEXT)
                            )) ORDER BY source.ordinality
                        ),
                        '[]'::JSONB
                    )
                    FROM jsonb_array_elements(p_payload->'manufacturing_sources')
                        WITH ORDINALITY AS source(value, ordinality)
                    WHERE source.ordinality <= 5
                )
            ELSE manufacturing_sources
        END,
        source_verification_consent = COALESCE((p_payload->>'source_verification_consent')::BOOLEAN, source_verification_consent),
        source_change_acknowledged = COALESCE((p_payload->>'source_change_acknowledged')::BOOLEAN, source_change_acknowledged),
        source_verification_status = CASE
            WHEN jsonb_typeof(p_payload->'manufacturing_sources') = 'array'
                THEN CASE WHEN jsonb_array_length(p_payload->'manufacturing_sources') = 0
                    THEN 'awaiting_details' ELSE 'pending_verification' END
            ELSE source_verification_status
        END,
        us_sales_channel_status = CASE
            WHEN p_payload->>'us_sales_channel_status' IN ('yes', 'no', 'in_progress', 'unknown')
                THEN p_payload->>'us_sales_channel_status'
            ELSE us_sales_channel_status
        END,
        us_sales_channel_notes = COALESCE(p_payload->>'us_sales_channel_notes', us_sales_channel_notes),
        vexim_support_needs = CASE
            WHEN jsonb_typeof(p_payload->'vexim_support_needs') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'vexim_support_needs'))
            ELSE vexim_support_needs
        END,
        vexim_support_other = COALESCE(p_payload->>'vexim_support_other', vexim_support_other),
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

GRANT EXECUTE ON FUNCTION public.submit_client_intake(TEXT, JSONB) TO anon, authenticated;
