
-- Allow admins to update and delete site_leads
CREATE POLICY "Admins can update site_leads"
  ON public.site_leads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Admins can delete site_leads"
  ON public.site_leads FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
