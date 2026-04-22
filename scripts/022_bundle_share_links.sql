-- ============================================================
-- Migration 022 — Bundle share links
--
-- Lets an admin mint ONE tokenized share link that grants a buyer
-- access to multiple compliance docs on a single /share/<token>
-- page (instead of one token per doc).
--
-- Backwards compatible:
--   • Existing rows in tokenized_share_links keep their non-null
--     doc_id and continue to work unchanged.
--   • New "bundle" rows insert doc_id = NULL, and list their docs
--     in the new join table tokenized_share_link_docs.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Allow doc_id NULL so a link can reference a bundle instead.
-- ------------------------------------------------------------
ALTER TABLE public.tokenized_share_links
  ALTER COLUMN doc_id DROP NOT NULL;

-- ------------------------------------------------------------
-- 2. Join table: which docs belong to each bundle token.
--    Composite PK ensures a doc can't be listed twice on the
--    same token. ON DELETE CASCADE keeps the table tidy when a
--    token or a doc is removed.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tokenized_share_link_docs (
  token UUID NOT NULL
    REFERENCES public.tokenized_share_links(token) ON DELETE CASCADE,
  doc_id UUID NOT NULL
    REFERENCES public.compliance_docs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_tokenized_share_link_docs_token
  ON public.tokenized_share_link_docs(token);

CREATE INDEX IF NOT EXISTS idx_tokenized_share_link_docs_doc
  ON public.tokenized_share_link_docs(doc_id);

-- ------------------------------------------------------------
-- 3. RLS — mirror the parent table's policies.
-- ------------------------------------------------------------
ALTER TABLE public.tokenized_share_link_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage share_link_docs"
  ON public.tokenized_share_link_docs;
CREATE POLICY "Admins manage share_link_docs"
  ON public.tokenized_share_link_docs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff', 'super_admin', 'account_executive')
    )
  );

-- Clients can read bundle membership for tokens they own.
DROP POLICY IF EXISTS "Clients view own share_link_docs"
  ON public.tokenized_share_link_docs;
CREATE POLICY "Clients view own share_link_docs"
  ON public.tokenized_share_link_docs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tokenized_share_links l
      WHERE l.token = tokenized_share_link_docs.token
        AND l.owner_id = auth.uid()
    )
  );

-- ============================================================
-- DONE. Verify with:
--   SELECT token, doc_id FROM public.tokenized_share_links LIMIT 5;
--   SELECT COUNT(*) FROM public.tokenized_share_link_docs;
-- ============================================================
