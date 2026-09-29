-- 101: Keep supplier intake text in its original language while storing the
-- AI-translated English text in the existing fields used by profiles/catalog.
-- Apply this migration before deploying the AI translation code.

ALTER TABLE public.client_intake_submissions
  ADD COLUMN IF NOT EXISTS source_texts JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_language TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'not_needed';

DO $$
BEGIN
  ALTER TABLE public.client_intake_submissions
    ADD CONSTRAINT client_intake_translation_status_check
    CHECK (translation_status IN ('not_needed', 'translated', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.client_intake_submissions.source_texts IS
  'Original supplier-entered free-text fields, before English translation; visible only to authorized reviewers.';
COMMENT ON COLUMN public.client_intake_submissions.source_language IS
  'Language detected for the supplier-entered free text by the translation model.';
COMMENT ON COLUMN public.client_intake_submissions.translation_status IS
  'AI translation outcome: translated, not_needed, or failed (the source text remains in the main fields on failure).';

-- Keep product originals out of client_products: active products are publicly
-- readable, so storing source text on that table would expose it to buyers.
CREATE TABLE IF NOT EXISTS public.client_product_intake_sources (
  product_id UUID PRIMARY KEY
    REFERENCES public.client_products(id) ON DELETE CASCADE,
  client_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_texts JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_language TEXT,
  translation_status TEXT NOT NULL DEFAULT 'not_needed'
    CHECK (translation_status IN ('not_needed', 'translated', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_product_intake_sources_client
  ON public.client_product_intake_sources(client_id);

ALTER TABLE public.client_product_intake_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_product_intake_sources FROM anon, authenticated;
GRANT SELECT ON public.client_product_intake_sources TO authenticated;
GRANT ALL ON public.client_product_intake_sources TO service_role;

DROP POLICY IF EXISTS "client_product_intake_sources_authorized_read"
  ON public.client_product_intake_sources;
CREATE POLICY "client_product_intake_sources_authorized_read"
  ON public.client_product_intake_sources
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff')
    )
  );

COMMENT ON TABLE public.client_product_intake_sources IS
  'Private original-language text from public supplier product intake forms; never exposed on the public catalog.';
COMMENT ON COLUMN public.client_product_intake_sources.source_texts IS
  'Original free-text product fields before English translation.';

-- Extend the existing token-protected submission RPC with private translation
-- metadata. The token/status/expiry checks and all existing intake fields stay
-- unchanged.
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
        source_texts = COALESCE(p_payload->'source_texts', source_texts),
        source_language = COALESCE(p_payload->>'source_language', source_language),
        translation_status = COALESCE(p_payload->>'translation_status', translation_status),
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
