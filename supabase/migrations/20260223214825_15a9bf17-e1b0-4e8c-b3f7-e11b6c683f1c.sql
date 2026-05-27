
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- crm_stages
DROP POLICY IF EXISTS "Org members can create stages" ON public.crm_stages;
DROP POLICY IF EXISTS "Org members can delete stages" ON public.crm_stages;
DROP POLICY IF EXISTS "Org members can update stages" ON public.crm_stages;
DROP POLICY IF EXISTS "Org members can view stages" ON public.crm_stages;

CREATE POLICY "Org members can view stages" ON public.crm_stages FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can create stages" ON public.crm_stages FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update stages" ON public.crm_stages FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete stages" ON public.crm_stages FOR DELETE USING (is_org_member(org_id));

-- integrations
DROP POLICY IF EXISTS "Admins can create integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON public.integrations;
DROP POLICY IF EXISTS "Org members can view integrations" ON public.integrations;

CREATE POLICY "Org members can view integrations" ON public.integrations FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Admins can create integrations" ON public.integrations FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update integrations" ON public.integrations FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete integrations" ON public.integrations FOR DELETE USING (is_org_admin(org_id));

-- leads_raw
DROP POLICY IF EXISTS "Org members can create leads" ON public.leads_raw;
DROP POLICY IF EXISTS "Org members can delete leads" ON public.leads_raw;
DROP POLICY IF EXISTS "Org members can update leads" ON public.leads_raw;
DROP POLICY IF EXISTS "Org members can view leads" ON public.leads_raw;

CREATE POLICY "Org members can view leads" ON public.leads_raw FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can create leads" ON public.leads_raw FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update leads" ON public.leads_raw FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete leads" ON public.leads_raw FOR DELETE USING (is_org_member(org_id));

-- opportunities
DROP POLICY IF EXISTS "Org members can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Org members can delete opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Org members can update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Org members can view opportunities" ON public.opportunities;

CREATE POLICY "Org members can view opportunities" ON public.opportunities FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can create opportunities" ON public.opportunities FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update opportunities" ON public.opportunities FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete opportunities" ON public.opportunities FOR DELETE USING (is_org_member(org_id));

-- organizations
DROP POLICY IF EXISTS "Authenticated can create org" ON public.organizations;
DROP POLICY IF EXISTS "Owner can update org" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their org" ON public.organizations;

CREATE POLICY "Users can view their org" ON public.organizations FOR SELECT USING (is_org_member(id) OR owner_id = auth.uid());
CREATE POLICY "Authenticated can create org" ON public.organizations FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update org" ON public.organizations FOR UPDATE USING (owner_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view org profiles" ON public.profiles;

CREATE POLICY "Users can view org profiles" ON public.profiles FOR SELECT USING (user_id = auth.uid() OR is_org_member(org_id));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Org members can view roles" ON public.user_roles;

CREATE POLICY "Org members can view roles" ON public.user_roles FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (is_org_admin(org_id));
