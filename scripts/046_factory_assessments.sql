-- ============================================================
-- 046: Client Factory Assessments Schema
-- Description: Internal factory capability assessment (form muc 6-15)
--              + scoring. NOT public-readable like client_profiles.
-- Date: 2026-08-04
-- ============================================================

-- 1. Create client_factory_assessments table
-- ============================================================

CREATE TABLE IF NOT EXISTS client_factory_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Muc 6: He thong quan ly chat luong & ATTP
    quality_systems TEXT[] DEFAULT '{}',
    quality_systems_other TEXT,

    -- Muc 7: Nang luc OEM/ODM + quy mo
    oem_odm TEXT[] DEFAULT '{}',
    company_scale TEXT,

    -- Muc 8: Kinh nghiem xuat khau
    export_since_year INTEGER,
    export_markets TEXT[] DEFAULT '{}',
    export_markets_other TEXT,

    -- Muc 9: Truy xuat nguon goc
    traceability TEXT[] DEFAULT '{}',

    -- Muc 12: Kha nang tiep don Buyer Audit
    audit_readiness TEXT[] DEFAULT '{}',
    audit_owner TEXT,

    -- Muc 13: Nang luc thuong mai (MOQ/Lead Time dong bo tu client_profiles)
    incoterms TEXT[] DEFAULT '{}',
    payment_policy TEXT,
    oem_policy TEXT,
    odm_policy TEXT,

    -- Muc 14: Nhan su phu trach du an
    has_export_dept BOOLEAN,
    has_english_staff BOOLEAN,
    pricing_decision_maker TEXT,

    -- Muc 15: Cam ket trien khai du an
    commitments TEXT[] DEFAULT '{}',
    project_priority TEXT,

    -- Cham diem
    score_total INTEGER,
    score_grade TEXT,
    score_breakdown JSONB DEFAULT '{}'::jsonb,
    scored_at TIMESTAMPTZ,

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_client_assessment UNIQUE (client_id)
);

-- 2. Create indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_factory_assessments_client_id ON client_factory_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_factory_assessments_score_grade ON client_factory_assessments(score_grade);

-- 3. Enable RLS
-- ============================================================

ALTER TABLE client_factory_assessments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- ============================================================

-- Internal Vexim (admin/staff/AE) can read all assessments
CREATE POLICY "factory_assessments_internal_read"
ON client_factory_assessments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- Client can read their own assessment
CREATE POLICY "factory_assessments_client_read"
ON client_factory_assessments
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

-- Internal Vexim can insert
CREATE POLICY "factory_assessments_internal_insert"
ON client_factory_assessments
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- Internal Vexim can update
CREATE POLICY "factory_assessments_internal_update"
ON client_factory_assessments
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- Internal Vexim can delete
CREATE POLICY "factory_assessments_internal_delete"
ON client_factory_assessments
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- 5. Trigger to update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_factory_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_factory_assessments_updated_at
    BEFORE UPDATE ON client_factory_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_factory_assessments_updated_at();

-- 6. Comments
-- ============================================================

COMMENT ON TABLE client_factory_assessments IS 'Internal factory capability assessment (Vexim form muc 6-15) + scoring. Not public.';
COMMENT ON COLUMN client_factory_assessments.quality_systems IS 'Muc 6: HACCP/GMP/ISO22000/SOP/QC/other';
COMMENT ON COLUMN client_factory_assessments.oem_odm IS 'Muc 7: OEM/ODM/Private Label/none';
COMMENT ON COLUMN client_factory_assessments.export_markets IS 'Muc 8: US/EU/JP/KR/CN/ASEAN/ME/other';
COMMENT ON COLUMN client_factory_assessments.traceability IS 'Muc 9: lot/input/finished/recall/batch-lot/none';
COMMENT ON COLUMN client_factory_assessments.audit_readiness IS 'Muc 12: onsite/online/not-ready';
COMMENT ON COLUMN client_factory_assessments.incoterms IS 'Muc 13: EXW/FOB/CIF';
COMMENT ON COLUMN client_factory_assessments.commitments IS 'Muc 15: priority/cooperation/accuracy';
COMMENT ON COLUMN client_factory_assessments.score_breakdown IS 'JSON per-category score detail';
