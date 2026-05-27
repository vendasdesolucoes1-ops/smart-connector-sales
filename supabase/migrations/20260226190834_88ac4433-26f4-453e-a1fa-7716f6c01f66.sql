
-- Allow platform admins to read all company profiles
CREATE POLICY "Platform admins can view all company profiles"
ON public.company_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
  )
);

-- Allow platform admins to update all company profiles
CREATE POLICY "Platform admins can update all company profiles"
ON public.company_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
  )
);

-- Allow platform admins to insert company profiles for any org
CREATE POLICY "Platform admins can insert company profiles"
ON public.company_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
  )
);

-- Allow platform admins to read all organizations
CREATE POLICY "Platform admins can view all organizations"
ON public.organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
  )
);
