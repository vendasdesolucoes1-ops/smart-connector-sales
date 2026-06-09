CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_raw_phone_trgm
  ON public.leads_raw
  USING GIN (phone gin_trgm_ops);
