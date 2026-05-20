-- Migration: Add expiry_notified_at column to compliance_docs
-- Run this in Supabase SQL Editor

-- Add the column
ALTER TABLE compliance_docs
ADD COLUMN IF NOT EXISTS expiry_notified_at DATE;

-- Add comment
COMMENT ON COLUMN compliance_docs.expiry_notified_at IS 'Last date when expiry notification was sent to the owner';

-- Optional: Create index for cron job efficiency
CREATE INDEX IF NOT EXISTS idx_compliance_docs_expiry_check
ON compliance_docs (expires_at)
WHERE expires_at IS NOT NULL;
