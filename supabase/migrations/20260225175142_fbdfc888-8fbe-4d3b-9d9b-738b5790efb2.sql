
-- Add keywords and summary columns for AI-powered retrieval
ALTER TABLE public.ai_knowledge_docs 
ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS summary text DEFAULT '',
ADD COLUMN IF NOT EXISTS chunks jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;

-- Create index for keyword search using GIN
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_docs_keywords ON public.ai_knowledge_docs USING GIN(keywords);

-- Create text search index on summary
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_docs_summary ON public.ai_knowledge_docs USING GIN(to_tsvector('portuguese', coalesce(summary, '')));
