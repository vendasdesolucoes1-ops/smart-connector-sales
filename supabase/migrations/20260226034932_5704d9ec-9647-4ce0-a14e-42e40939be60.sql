
-- Table for landing page form submissions
CREATE TABLE public.site_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  partnership_type TEXT,
  message TEXT,
  form_source TEXT NOT NULL DEFAULT 'early_access',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;

-- Only admins can read site leads
CREATE POLICY "Admins can read site_leads"
ON public.site_leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Anyone (anon) can insert (public form submissions)
CREATE POLICY "Anyone can submit site forms"
ON public.site_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Table for editable site content
CREATE TABLE public.site_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read site content (public)
CREATE POLICY "Anyone can read site_content"
ON public.site_content
FOR SELECT
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update site_content"
ON public.site_content
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert site_content"
ON public.site_content
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Insert default site content
INSERT INTO public.site_content (key, value) VALUES
  ('hero_title', 'Sua equipe de vendas era cara demais para existir.'),
  ('hero_subtitle', 'O VS SALES substitui sua equipe comercial inteira com IA. SDR, BDR, Closer — tudo automatizado, 24/7, por uma fração do custo.'),
  ('counter_leads', '12400'),
  ('counter_hours', '8300'),
  ('price_start', '1.497'),
  ('slots_total', '50'),
  ('slots_filled', '37');
