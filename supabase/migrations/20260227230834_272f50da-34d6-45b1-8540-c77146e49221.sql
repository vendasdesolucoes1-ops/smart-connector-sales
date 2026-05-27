
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Platform admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.activity_logs;

-- Recreate as explicitly PERMISSIVE
CREATE POLICY "Platform admins can view all activity logs"
ON public.activity_logs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role
  )
);

CREATE POLICY "Users can insert own activity logs"
ON public.activity_logs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
