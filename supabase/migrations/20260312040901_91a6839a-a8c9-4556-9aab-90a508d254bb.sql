-- Adicionar coluna de embedding na tabela de conhecimento
ALTER TABLE public.ai_knowledge_docs 
ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

-- Função de busca por similaridade
CREATE OR REPLACE FUNCTION match_knowledge_docs(
  query_embedding extensions.vector(768),
  match_org_id uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    title,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.ai_knowledge_docs
  WHERE org_id = match_org_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;