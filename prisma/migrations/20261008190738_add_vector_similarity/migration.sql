-- Vector similarity support.
--
-- WHY A FUNCTION INSTEAD OF pgvector
-- ----------------------------------
-- pgvector is not available for PostgreSQL 18 on Windows, so embeddings are
-- stored as `double precision[]` and compared with the function below. At this
-- corpus size (hundreds of schemes, a few thousand chunks) an exact scan is both
-- fast enough and strictly MORE accurate than pgvector's approximate HNSW index,
-- which trades recall for speed.
--
-- Embeddings are written L2-normalised by the AI service, so the cosine of two
-- vectors reduces to their dot product. That is why this is a dot product and
-- not a full cosine formula: normalising once at write time removes the need to
-- divide by magnitudes on every comparison.
--
-- TO MIGRATE TO pgvector LATER
-- ----------------------------
--   1. CREATE EXTENSION vector;
--   2. ALTER the embedding column to vector(384)
--   3. CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
--   4. Swap `<=>` in for this function in rag.service.ts
-- Nothing else changes: retrieval is already behind a single query function.

CREATE OR REPLACE FUNCTION fb_dot_product(a double precision[], b double precision[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  -- Mismatched lengths produce NULL via the zip, which the caller filters out.
  -- That is deliberate: silently comparing a 384-vector against a 768-vector
  -- would return a plausible-looking but meaningless score.
  SELECT CASE
    WHEN array_length(a, 1) IS DISTINCT FROM array_length(b, 1) THEN NULL
    ELSE COALESCE((SELECT SUM(x * y) FROM unnest(a, b) AS t(x, y)), 0)
  END;
$$;

COMMENT ON FUNCTION fb_dot_product(double precision[], double precision[]) IS
  'Cosine similarity for L2-normalised embedding vectors. Returns NULL on a dimension mismatch.';

-- Retrieval filters on these before scoring, so the index keeps the candidate
-- set small even though the similarity itself cannot be indexed.
CREATE INDEX IF NOT EXISTS "SchemeDocumentChunk_embeddingModel_idx"
  ON "SchemeDocumentChunk" ("embeddingModel");
