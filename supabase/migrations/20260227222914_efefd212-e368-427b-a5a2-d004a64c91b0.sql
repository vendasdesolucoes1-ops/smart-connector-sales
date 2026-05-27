
-- Drop the overly permissive service role policy and rely on service_role key bypassing RLS
DROP POLICY "Service role can insert logs" ON public.activity_logs;
