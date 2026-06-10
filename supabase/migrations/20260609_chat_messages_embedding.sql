-- Add embedding column to chat_messages for semantic similarity checks.
-- Gemini embedding-001 produces 768-dimensional vectors.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Partial index: only index bot messages with embeddings for fast similarity queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_bot_embedding
  ON public.chat_messages
  USING ivfflat (embedding vector_cosine_ops)
  WHERE from_me = true AND embedding IS NOT NULL;
