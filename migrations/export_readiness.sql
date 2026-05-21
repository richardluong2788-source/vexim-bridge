-- ============================================================================
-- AI Export Readiness Coach - Database Migration
-- ============================================================================
-- Run this migration manually in your Supabase SQL Editor or via psql.
-- This creates the export_readiness_assessments table and updates profiles.
-- ============================================================================

-- 1. Create the export_readiness_assessments table
CREATE TABLE IF NOT EXISTS export_readiness_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Scores (0-100)
  readiness_score INTEGER CHECK (readiness_score >= 0 AND readiness_score <= 100),
  
  -- Tier classification
  tier VARCHAR(20) CHECK (tier IN ('gold', 'potential', 'pending')),
  
  -- Analysis results (JSONB arrays)
  strengths JSONB DEFAULT '[]'::jsonb,
  gaps JSONB DEFAULT '[]'::jsonb,
  action_plan JSONB DEFAULT '[]'::jsonb,
  
  -- Raw questionnaire data
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Progress tracking
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
  current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 4),
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add new columns to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS readiness_tier VARCHAR(20) CHECK (readiness_tier IN ('gold', 'potential', 'pending')),
  ADD COLUMN IF NOT EXISTS last_assessment_id UUID REFERENCES export_readiness_assessments(id);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assessments_client_id ON export_readiness_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON export_readiness_assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_tier ON export_readiness_assessments(tier);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON export_readiness_assessments(created_at DESC);

-- 4. Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_assessment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assessment_updated_at ON export_readiness_assessments;
CREATE TRIGGER trigger_assessment_updated_at
  BEFORE UPDATE ON export_readiness_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_assessment_updated_at();

-- 5. Create trigger to sync readiness_tier to profiles when assessment is completed
CREATE OR REPLACE FUNCTION sync_profile_readiness_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.tier IS NOT NULL THEN
    UPDATE profiles
    SET 
      readiness_tier = NEW.tier,
      last_assessment_id = NEW.id
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_readiness_tier ON export_readiness_assessments;
CREATE TRIGGER trigger_sync_readiness_tier
  AFTER INSERT OR UPDATE ON export_readiness_assessments
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_readiness_tier();

-- 6. Enable RLS (Row Level Security)
ALTER TABLE export_readiness_assessments ENABLE ROW LEVEL SECURITY;

-- Clients can view and update their own assessments
CREATE POLICY "Clients can view own assessments" ON export_readiness_assessments
  FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can insert own assessments" ON export_readiness_assessments
  FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own assessments" ON export_readiness_assessments
  FOR UPDATE
  USING (auth.uid() = client_id);

-- Staff/Admin can view all assessments
CREATE POLICY "Staff can view all assessments" ON export_readiness_assessments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive', 'lead_researcher')
    )
  );

-- Staff/Admin can update all assessments
CREATE POLICY "Staff can update all assessments" ON export_readiness_assessments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'staff', 'account_executive')
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm success)
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'export_readiness_assessments';
--
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name IN ('readiness_tier', 'last_assessment_id');
-- ============================================================================
