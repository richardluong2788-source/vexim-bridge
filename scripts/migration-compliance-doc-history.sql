-- Migration: Create compliance_doc_history table for audit trail
-- Run this in Supabase SQL Editor

-- Create history table
-- NOTE: doc_id intentionally has NO foreign key to compliance_docs(id).
-- The audit trigger below writes a 'deleted' row AFTER the source row in
-- compliance_docs is already gone, so a hard FK here would always fail on
-- delete (see scripts/048_fix_compliance_doc_history_fk.sql). An audit
-- trail must be able to reference rows that no longer exist.
CREATE TABLE IF NOT EXISTS compliance_doc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'expired', 'renewed')),
  changed_by UUID REFERENCES profiles(id),
  changes JSONB,
  old_values JSONB,
  new_values JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_compliance_doc_history_doc_id ON compliance_doc_history(doc_id);
CREATE INDEX IF NOT EXISTS idx_compliance_doc_history_owner_id ON compliance_doc_history(owner_id);
CREATE INDEX IF NOT EXISTS idx_compliance_doc_history_created_at ON compliance_doc_history(created_at DESC);

-- Add comment
COMMENT ON TABLE compliance_doc_history IS 'Audit trail for compliance document changes';

-- Grant RLS
ALTER TABLE compliance_doc_history ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can view their own document history
CREATE POLICY "Users can view own doc history"
ON compliance_doc_history
FOR SELECT
USING (auth.uid() = owner_id);

-- Policy: Admins can view all history
CREATE POLICY "Admins can view all doc history"
ON compliance_doc_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin', 'account_executive')
  )
);

-- Policy: Insert allowed for authenticated users
CREATE POLICY "Authenticated users can insert history"
ON compliance_doc_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger function to auto-log changes
CREATE OR REPLACE FUNCTION log_compliance_doc_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO compliance_doc_history (doc_id, owner_id, action, changed_by, new_values)
    VALUES (
      NEW.id,
      NEW.owner_id,
      'created',
      NEW.uploaded_by,
      jsonb_build_object(
        'kind', NEW.kind,
        'title', NEW.title,
        'expires_at', NEW.expires_at,
        'issued_at', NEW.issued_at
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if meaningful fields changed
    IF OLD.title IS DISTINCT FROM NEW.title
       OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
       OR OLD.issued_at IS DISTINCT FROM NEW.issued_at
       OR OLD.notes IS DISTINCT FROM NEW.notes
       OR OLD.url IS DISTINCT FROM NEW.url
    THEN
      INSERT INTO compliance_doc_history (doc_id, owner_id, action, changed_by, old_values, new_values, changes)
      VALUES (
        NEW.id,
        NEW.owner_id,
        'updated',
        auth.uid(),
        jsonb_build_object(
          'title', OLD.title,
          'expires_at', OLD.expires_at,
          'issued_at', OLD.issued_at,
          'notes', OLD.notes
        ),
        jsonb_build_object(
          'title', NEW.title,
          'expires_at', NEW.expires_at,
          'issued_at', NEW.issued_at,
          'notes', NEW.notes
        ),
        jsonb_build_object(
          'title_changed', OLD.title IS DISTINCT FROM NEW.title,
          'expires_at_changed', OLD.expires_at IS DISTINCT FROM NEW.expires_at,
          'issued_at_changed', OLD.issued_at IS DISTINCT FROM NEW.issued_at,
          'notes_changed', OLD.notes IS DISTINCT FROM NEW.notes,
          'file_changed', OLD.url IS DISTINCT FROM NEW.url
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO compliance_doc_history (doc_id, owner_id, action, changed_by, old_values)
    VALUES (
      OLD.id,
      OLD.owner_id,
      'deleted',
      auth.uid(),
      jsonb_build_object(
        'kind', OLD.kind,
        'title', OLD.title,
        'expires_at', OLD.expires_at
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS compliance_doc_audit_trigger ON compliance_docs;
CREATE TRIGGER compliance_doc_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON compliance_docs
FOR EACH ROW EXECUTE FUNCTION log_compliance_doc_changes();
