
-- Allow platform admins to SELECT from all org-scoped tables needed by admin panel

CREATE POLICY "Platform admins can view all leads"
ON public.leads_raw FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can view all ai_configs"
ON public.ai_configs FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can update all ai_configs"
ON public.ai_configs FOR UPDATE
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can view all opportunities"
ON public.opportunities FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can view all appointments"
ON public.appointments FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can view all conversations"
ON public.conversation_tracker FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can view all integrations"
ON public.integrations FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can view all broadcasts"
ON public.broadcasts FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

CREATE POLICY "Platform admins can view all profiles"
ON public.profiles FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
