
-- ========================================
-- 1. Create ai_scenarios table
-- ========================================
CREATE TABLE public.ai_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scenario_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  temperature NUMERIC DEFAULT 0.7,
  enabled BOOLEAN DEFAULT true,
  behavior JSONB DEFAULT '{"max_messages": 15, "delay_seconds": 5, "use_emoji": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, scenario_key)
);

-- Trigger for updated_at
CREATE TRIGGER update_ai_scenarios_updated_at
  BEFORE UPDATE ON public.ai_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- 2. RLS policies
-- ========================================
ALTER TABLE public.ai_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scenarios"
  ON public.ai_scenarios FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Org members can update scenarios"
  ON public.ai_scenarios FOR UPDATE
  USING (is_org_member(org_id));

CREATE POLICY "Org members can insert scenarios"
  ON public.ai_scenarios FOR INSERT
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org members can delete scenarios"
  ON public.ai_scenarios FOR DELETE
  USING (is_org_member(org_id));

CREATE POLICY "Platform admins can view all scenarios"
  ON public.ai_scenarios FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role
  ));

CREATE POLICY "Platform admins can update all scenarios"
  ON public.ai_scenarios FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role
  ));

-- ========================================
-- 3. Add scenario_key to broadcasts
-- ========================================
ALTER TABLE public.broadcasts ADD COLUMN scenario_key TEXT DEFAULT 'broadcast_own_base';

-- ========================================
-- 4. Add scenario_key to conversation_tracker
-- ========================================
ALTER TABLE public.conversation_tracker ADD COLUMN scenario_key TEXT DEFAULT NULL;

-- ========================================
-- 5. Seed 4 scenarios for each existing org
-- ========================================
INSERT INTO public.ai_scenarios (org_id, scenario_key, name, description, system_prompt)
SELECT 
  o.id,
  s.key,
  s.name,
  s.description,
  COALESCE(
    CASE s.key
      WHEN 'outbound_prospecting' THEN (SELECT config->>'prompt_b2b' FROM public.ai_configs WHERE org_id = o.id AND config_type = 'sales_agent' LIMIT 1)
      WHEN 'broadcast_own_base' THEN (SELECT config->>'prompt_b2c_broadcast' FROM public.ai_configs WHERE org_id = o.id AND config_type = 'sales_agent' LIMIT 1)
      WHEN 'broadcast_whatsapp' THEN (SELECT config->>'prompt_b2c_broadcast' FROM public.ai_configs WHERE org_id = o.id AND config_type = 'sales_agent' LIMIT 1)
      WHEN 'organic_inbound' THEN (SELECT config->>'prompt_b2c_organic' FROM public.ai_configs WHERE org_id = o.id AND config_type = 'sales_agent' LIMIT 1)
    END,
    ''
  )
FROM public.organizations o
CROSS JOIN (VALUES 
  ('outbound_prospecting', 'Prospecção Outbound', 'Abordagem de empresas raspadas via prospecção ativa. Tom B2B, qualificação e agendamento.'),
  ('broadcast_own_base', 'Disparo Base Própria', 'Disparo para leads frios da sua base. Tom personalizado conforme seu público.'),
  ('broadcast_whatsapp', 'Disparo WhatsApp (Grupos)', 'Abordagem de leads extraídos de grupos de WhatsApp. Apresentação e qualificação.'),
  ('organic_inbound', 'Atendimento Orgânico', 'Atendimento de leads que chamam no WhatsApp espontaneamente. Receptivo e qualificação.')
) AS s(key, name, description)
ON CONFLICT (org_id, scenario_key) DO NOTHING;

-- ========================================
-- 6. Function to auto-seed scenarios on new org
-- ========================================
CREATE OR REPLACE FUNCTION public.seed_org_scenarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_scenarios (org_id, scenario_key, name, description) VALUES
    (NEW.id, 'outbound_prospecting', 'Prospecção Outbound', 'Abordagem de empresas raspadas via prospecção ativa. Tom B2B, qualificação e agendamento.'),
    (NEW.id, 'broadcast_own_base', 'Disparo Base Própria', 'Disparo para leads frios da sua base. Tom personalizado conforme seu público.'),
    (NEW.id, 'broadcast_whatsapp', 'Disparo WhatsApp (Grupos)', 'Abordagem de leads extraídos de grupos de WhatsApp. Apresentação e qualificação.'),
    (NEW.id, 'organic_inbound', 'Atendimento Orgânico', 'Atendimento de leads que chamam no WhatsApp espontaneamente. Receptivo e qualificação.')
  ON CONFLICT (org_id, scenario_key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_scenarios_on_org_create
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_org_scenarios();
