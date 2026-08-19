-- Migration 048: fix compliance_doc_history.doc_id FK breaking document deletes
--
-- Bug: compliance_doc_history.doc_id had `REFERENCES compliance_docs(id)`.
-- The audit trigger (compliance_doc_audit_trigger, AFTER DELETE) inserts a
-- 'deleted' row into compliance_doc_history with doc_id = OLD.id AFTER the
-- row in compliance_docs is already gone. That insert then violates the FK
-- ("Key (doc_id)=(...) is not present in table compliance_docs"), because
-- the parent row no longer exists by the time the AFTER DELETE trigger runs.
--
-- An audit/history table's entire purpose is to outlive the row it
-- describes, so doc_id must NOT be a hard FK to the live table. We drop the
-- constraint and keep doc_id as a plain indexed UUID column instead.

ALTER TABLE compliance_doc_history
  DROP CONSTRAINT IF EXISTS compliance_doc_history_doc_id_fkey;

-- Index already exists from the original migration (idx_compliance_doc_history_doc_id),
-- but ensure it's present in case this runs standalone.
CREATE INDEX IF NOT EXISTS idx_compliance_doc_history_doc_id ON compliance_doc_history(doc_id);
