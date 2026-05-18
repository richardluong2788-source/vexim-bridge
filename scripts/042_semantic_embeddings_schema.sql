-- ============================================================================
-- Script 042: Semantic Embeddings Schema for AI Matching
-- ============================================================================
-- Enable pgvector extension and create tables for storing embeddings
-- used in semantic product matching between buyers and clients.
-- ============================================================================

-- Enable pgvector extension (Supabase has this pre-installed)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Table: product_embeddings
-- Stores vector embeddings for client product descriptions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('product', 'category', 'description', 'combined')),
  source_text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small outputs 1536 dimensions
  model_version TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate embeddings for same source
  CONSTRAINT unique_client_source UNIQUE (client_id, source_type, source_text)
);

-- ============================================================================
-- Table: buyer_embeddings  
-- Stores vector embeddings for buyer/lead product interests
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.buyer_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('hs_codes', 'keywords', 'product_interest', 'combined')),
  source_text TEXT NOT NULL,
  embedding vector(1536),
  model_version TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One embedding per lead per source type
  CONSTRAINT unique_lead_source UNIQUE (lead_id, source_type)
);

-- ============================================================================
-- Indexes for fast similarity search
-- Using IVFFlat for approximate nearest neighbor search
-- ============================================================================

-- Index for product embeddings
CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector 
ON product_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Index for buyer embeddings
CREATE INDEX IF NOT EXISTS idx_buyer_embeddings_vector 
ON buyer_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Standard indexes for filtering
CREATE INDEX IF NOT EXISTS idx_product_embeddings_client 
ON product_embeddings(client_id);

CREATE INDEX IF NOT EXISTS idx_buyer_embeddings_lead 
ON buyer_embeddings(lead_id);

-- ============================================================================
-- Function: match_buyer_to_products
-- Find most similar products for a given buyer embedding
-- ============================================================================
CREATE OR REPLACE FUNCTION match_buyer_to_products(
  buyer_embedding vector(1536),
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  client_id UUID,
  source_text TEXT,
  source_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.client_id,
    pe.source_text,
    pe.source_type,
    (1 - (pe.embedding <=> buyer_embedding))::FLOAT AS similarity
  FROM product_embeddings pe
  WHERE pe.embedding IS NOT NULL
    AND (1 - (pe.embedding <=> buyer_embedding)) >= similarity_threshold
  ORDER BY pe.embedding <=> buyer_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Function: match_products_to_buyer
-- Find most similar buyers for a given product/client embedding
-- (Useful for reverse matching - finding buyers interested in a client's products)
-- ============================================================================
CREATE OR REPLACE FUNCTION match_products_to_buyer(
  product_embedding vector(1536),
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  lead_id UUID,
  source_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    be.lead_id,
    be.source_text,
    (1 - (be.embedding <=> product_embedding))::FLOAT AS similarity
  FROM buyer_embeddings be
  WHERE be.embedding IS NOT NULL
    AND (1 - (be.embedding <=> product_embedding)) >= similarity_threshold
  ORDER BY be.embedding <=> product_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Function: get_semantic_match_score
-- Direct similarity calculation between a buyer and specific client
-- ============================================================================
CREATE OR REPLACE FUNCTION get_semantic_match_score(
  p_lead_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  max_similarity FLOAT,
  avg_similarity FLOAT,
  match_count INT,
  top_matches JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_embedding vector(1536);
BEGIN
  -- Get buyer embedding
  SELECT embedding INTO v_buyer_embedding
  FROM buyer_embeddings
  WHERE lead_id = p_lead_id
    AND source_type = 'combined'
  LIMIT 1;
  
  IF v_buyer_embedding IS NULL THEN
    RETURN QUERY SELECT 
      0::FLOAT AS max_similarity,
      0::FLOAT AS avg_similarity,
      0::INT AS match_count,
      '[]'::JSONB AS top_matches;
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH matches AS (
    SELECT 
      pe.source_text,
      (1 - (pe.embedding <=> v_buyer_embedding))::FLOAT AS sim
    FROM product_embeddings pe
    WHERE pe.client_id = p_client_id
      AND pe.embedding IS NOT NULL
    ORDER BY pe.embedding <=> v_buyer_embedding
    LIMIT 5
  )
  SELECT 
    COALESCE(MAX(m.sim), 0)::FLOAT,
    COALESCE(AVG(m.sim), 0)::FLOAT,
    COUNT(*)::INT,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('product', m.source_text, 'similarity', ROUND(m.sim::numeric, 3))
        ORDER BY m.sim DESC
      ),
      '[]'::JSONB
    )
  FROM matches m;
END;
$$;

-- ============================================================================
-- Table: semantic_match_logs
-- Audit log for semantic matching operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.semantic_match_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  operation TEXT NOT NULL, -- 'matching', 'embedding_sync', 'bulk_sync'
  input_data JSONB,
  result_data JSONB,
  execution_time_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semantic_match_logs_lead 
ON semantic_match_logs(lead_id);

CREATE INDEX IF NOT EXISTS idx_semantic_match_logs_created 
ON semantic_match_logs(created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_match_logs ENABLE ROW LEVEL SECURITY;

-- Product embeddings: Admins can manage all, clients can view their own
CREATE POLICY "Admins can manage all product embeddings" ON product_embeddings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Clients can view own product embeddings" ON product_embeddings
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Buyer embeddings: Only admins can access
CREATE POLICY "Admins can manage all buyer embeddings" ON buyer_embeddings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Semantic match logs: Only admins
CREATE POLICY "Admins can view semantic match logs" ON semantic_match_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- Trigger: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_embedding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_embeddings_updated
  BEFORE UPDATE ON product_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_embedding_timestamp();

CREATE TRIGGER trigger_buyer_embeddings_updated
  BEFORE UPDATE ON buyer_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_embedding_timestamp();

-- ============================================================================
-- Grant permissions to service role
-- ============================================================================
GRANT ALL ON product_embeddings TO service_role;
GRANT ALL ON buyer_embeddings TO service_role;
GRANT ALL ON semantic_match_logs TO service_role;
GRANT EXECUTE ON FUNCTION match_buyer_to_products TO service_role;
GRANT EXECUTE ON FUNCTION match_products_to_buyer TO service_role;
GRANT EXECUTE ON FUNCTION get_semantic_match_score TO service_role;
