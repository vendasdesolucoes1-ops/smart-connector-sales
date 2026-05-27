
-- Add status and notes columns to site_leads for sales management
ALTER TABLE public.site_leads 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_selected text;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_site_leads_status ON public.site_leads(status);
CREATE INDEX IF NOT EXISTS idx_site_leads_form_source ON public.site_leads(form_source);
