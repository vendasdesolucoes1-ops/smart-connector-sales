
-- Company profiles table for "Minha Empresa" module
CREATE TABLE public.company_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  segment TEXT,
  description TEXT DEFAULT '',
  mission TEXT DEFAULT '',
  vision TEXT DEFAULT '',
  values TEXT DEFAULT '',
  products_services JSONB DEFAULT '[]'::jsonb,
  target_audience TEXT DEFAULT '',
  differentials TEXT DEFAULT '',
  tone_of_voice TEXT DEFAULT '',
  website TEXT,
  instagram TEXT,
  linkedin TEXT,
  facebook TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  cnpj TEXT,
  founded_year INTEGER,
  team_size TEXT,
  avg_ticket TEXT,
  sales_process TEXT DEFAULT '',
  objections_faq JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view company profile"
  ON public.company_profiles FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Org members can create company profile"
  ON public.company_profiles FOR INSERT
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org members can update company profile"
  ON public.company_profiles FOR UPDATE
  USING (is_org_member(org_id));

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for company assets (logos, documents)
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

CREATE POLICY "Authenticated users can upload company assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view company assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-assets');

CREATE POLICY "Authenticated users can update company assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'company-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete company assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'company-assets' AND auth.role() = 'authenticated');
