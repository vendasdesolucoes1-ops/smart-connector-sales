
-- Add unique form token to organizations for public form links
ALTER TABLE public.organizations ADD COLUMN form_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Ensure uniqueness
CREATE UNIQUE INDEX idx_organizations_form_token ON public.organizations (form_token);
