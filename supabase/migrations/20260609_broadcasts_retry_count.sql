ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
