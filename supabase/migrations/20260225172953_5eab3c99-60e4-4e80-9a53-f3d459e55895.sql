
-- AI Configuration table (chatbot settings, prompts, schedules per org)
CREATE TABLE public.ai_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  config_type TEXT NOT NULL, -- 'chatbot', 'assistant', 'enrichment', 'messages'
  instance_name TEXT, -- WhatsApp instance name (for chatbot)
  enabled BOOLEAN NOT NULL DEFAULT false,
  system_prompt TEXT DEFAULT '',
  temperature NUMERIC DEFAULT 0.7,
  schedule_start TIME, -- business hours start
  schedule_end TIME, -- business hours end
  schedule_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Mon-Fri
  only_outside_hours BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, config_type, instance_name)
);

ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view AI configs"
ON public.ai_configs FOR SELECT
USING (is_org_member(org_id));

CREATE POLICY "Admins can create AI configs"
ON public.ai_configs FOR INSERT
WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Admins can update AI configs"
ON public.ai_configs FOR UPDATE
USING (is_org_admin(org_id));

CREATE POLICY "Admins can delete AI configs"
ON public.ai_configs FOR DELETE
USING (is_org_admin(org_id));

CREATE TRIGGER update_ai_configs_updated_at
BEFORE UPDATE ON public.ai_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Knowledge base documents table
CREATE TABLE public.ai_knowledge_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view knowledge docs"
ON public.ai_knowledge_docs FOR SELECT
USING (is_org_member(org_id));

CREATE POLICY "Admins can create knowledge docs"
ON public.ai_knowledge_docs FOR INSERT
WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Admins can update knowledge docs"
ON public.ai_knowledge_docs FOR UPDATE
USING (is_org_admin(org_id));

CREATE POLICY "Admins can delete knowledge docs"
ON public.ai_knowledge_docs FOR DELETE
USING (is_org_admin(org_id));

CREATE TRIGGER update_ai_knowledge_docs_updated_at
BEFORE UPDATE ON public.ai_knowledge_docs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
