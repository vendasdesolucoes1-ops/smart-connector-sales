
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Enum for lead source
CREATE TYPE public.lead_source AS ENUM ('web', 'whatsapp', 'manual', 'import');

-- Enum for lead status
CREATE TYPE public.lead_status AS ENUM ('pending', 'enriched', 'converted', 'discarded');

-- Enum for integration service
CREATE TYPE public.integration_service AS ENUM ('firecrawl', 'hasdata', 'evolution', 'supabase_external', 'perplexity');

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_mapping JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

-- Integrations
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_name public.integration_service NOT NULL,
  api_key TEXT,
  endpoint_url TEXT,
  status TEXT DEFAULT 'pending',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, service_name)
);

-- Leads raw
CREATE TABLE public.leads_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  source public.lead_source NOT NULL DEFAULT 'manual',
  status public.lead_status NOT NULL DEFAULT 'pending',
  enrichment_data JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRM stages
CREATE TABLE public.crm_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opportunities
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  value NUMERIC(12,2) DEFAULT 0,
  probability INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Helper: get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Helper: check org membership
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND org_id = p_org_id
  );
$$;

-- Helper: check org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND org_id = p_org_id AND role = 'admin'
  );
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_raw_updated_at BEFORE UPDATE ON public.leads_raw FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: organizations
CREATE POLICY "Users can view their org" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id) OR owner_id = auth.uid());
CREATE POLICY "Owner can update org" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Authenticated can create org" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- RLS: profiles
CREATE POLICY "Users can view org profiles" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: user_roles
CREATE POLICY "Org members can view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- RLS: integrations
CREATE POLICY "Org members can view integrations" ON public.integrations FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Admins can create integrations" ON public.integrations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));
CREATE POLICY "Admins can update integrations" ON public.integrations FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));
CREATE POLICY "Admins can delete integrations" ON public.integrations FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- RLS: leads_raw
CREATE POLICY "Org members can view leads" ON public.leads_raw FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Org members can create leads" ON public.leads_raw FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "Org members can update leads" ON public.leads_raw FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Org members can delete leads" ON public.leads_raw FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));

-- RLS: crm_stages
CREATE POLICY "Org members can view stages" ON public.crm_stages FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Org members can create stages" ON public.crm_stages FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "Org members can update stages" ON public.crm_stages FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Org members can delete stages" ON public.crm_stages FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));

-- RLS: opportunities
CREATE POLICY "Org members can view opportunities" ON public.opportunities FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Org members can create opportunities" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "Org members can update opportunities" ON public.opportunities FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Org members can delete opportunities" ON public.opportunities FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));

-- Indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX idx_user_roles_user_org ON public.user_roles(user_id, org_id);
CREATE INDEX idx_leads_raw_org_id ON public.leads_raw(org_id);
CREATE INDEX idx_leads_raw_status ON public.leads_raw(status);
CREATE INDEX idx_opportunities_org_id ON public.opportunities(org_id);
CREATE INDEX idx_opportunities_stage_id ON public.opportunities(stage_id);
CREATE INDEX idx_integrations_org_id ON public.integrations(org_id);
