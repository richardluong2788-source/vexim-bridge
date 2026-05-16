-- ============================================================
-- 038: Client Profiles Schema
-- Description: Public-facing client profiles for buyers
-- Date: 2026-05-16
-- ============================================================

-- 1. Create client_profiles table
-- ============================================================

CREATE TABLE IF NOT EXISTS client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- URL slug (unique identifier for public URL)
    slug VARCHAR(100) NOT NULL,
    
    -- Branding
    cover_image_url TEXT,
    logo_url TEXT,
    
    -- Display info
    display_name VARCHAR(255),
    tagline TEXT,
    
    -- Video
    video_url TEXT,
    video_thumbnail_url TEXT,
    
    -- USP Points (JSON array of { icon, title })
    usp_points JSONB DEFAULT '[]'::jsonb,
    
    -- Production stats
    production_capacity VARCHAR(255),
    moq VARCHAR(100),
    lead_time_days VARCHAR(100),
    
    -- Featured items (array of UUIDs)
    featured_certifications UUID[] DEFAULT '{}',
    featured_products UUID[] DEFAULT '{}',
    
    -- CTA options
    enable_request_quote BOOLEAN DEFAULT true,
    enable_download_pdf BOOLEAN DEFAULT true,
    pdf_capability_url TEXT,
    
    -- Visibility
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    
    -- View tracking
    view_count INTEGER DEFAULT 0,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT unique_client_profile UNIQUE (client_id),
    CONSTRAINT unique_slug UNIQUE (slug)
);

-- 2. Create indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_client_profiles_client_id ON client_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_slug ON client_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_client_profiles_is_published ON client_profiles(is_published);
CREATE INDEX IF NOT EXISTS idx_client_profiles_published_at ON client_profiles(published_at);

-- 3. Enable RLS
-- ============================================================

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- ============================================================

-- Public can read published profiles
CREATE POLICY "client_profiles_public_read"
ON client_profiles
FOR SELECT
TO anon, authenticated
USING (is_published = true);

-- Admin/Staff can read all profiles
CREATE POLICY "client_profiles_admin_read"
ON client_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- Admin/Staff can create profiles
CREATE POLICY "client_profiles_admin_insert"
ON client_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- Admin/Staff can update profiles
CREATE POLICY "client_profiles_admin_update"
ON client_profiles
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

-- Admin/Staff can delete profiles
CREATE POLICY "client_profiles_admin_delete"
ON client_profiles
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
);

-- 5. Function to update view_count (bypass RLS for public)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_profile_view_count(profile_slug VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE client_profiles
    SET view_count = view_count + 1
    WHERE slug = profile_slug
    AND is_published = true;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION increment_profile_view_count(VARCHAR) TO anon, authenticated;

-- 6. Trigger to update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_client_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_client_profiles_updated_at
    BEFORE UPDATE ON client_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_client_profiles_updated_at();

-- 7. Comments
-- ============================================================

COMMENT ON TABLE client_profiles IS 'Public-facing profiles for clients (suppliers) viewable by buyers';
COMMENT ON COLUMN client_profiles.slug IS 'URL-safe unique identifier for public profile URL';
COMMENT ON COLUMN client_profiles.usp_points IS 'JSON array of USP points: [{ "icon": "Factory", "title": "20+ Years Experience" }]';
COMMENT ON COLUMN client_profiles.featured_certifications IS 'Array of compliance_docs IDs to feature';
COMMENT ON COLUMN client_profiles.featured_products IS 'Array of client_products IDs to feature';
COMMENT ON COLUMN client_profiles.is_published IS 'Whether profile is visible to public';
COMMENT ON COLUMN client_profiles.view_count IS 'Number of times profile has been viewed';
