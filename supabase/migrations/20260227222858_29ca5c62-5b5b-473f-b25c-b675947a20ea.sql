
-- Activity logs table for admin monitoring
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_email text,
  user_name text,
  action text NOT NULL,
  description text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all logs
CREATE POLICY "Platform admins can view all activity logs"
ON public.activity_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));

-- Authenticated users can insert their own logs
CREATE POLICY "Users can insert own activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert logs"
ON public.activity_logs FOR INSERT
WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_org_id ON public.activity_logs(org_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
