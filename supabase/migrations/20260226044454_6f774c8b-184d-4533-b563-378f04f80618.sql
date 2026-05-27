
-- Regras de follow-up por agente (cadência configurável)
CREATE TABLE public.follow_up_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  ai_config_id UUID NOT NULL REFERENCES public.ai_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Follow-up',
  delay_minutes INTEGER NOT NULL DEFAULT 30,
  step_order INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  context_hint TEXT, -- ex: "reativar lead", "lembrar proposta"
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rastreamento de conversas para saber quando mandar follow-up
CREATE TABLE public.conversation_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  instance_name TEXT NOT NULL,
  remote_jid TEXT NOT NULL, -- telefone do lead
  push_name TEXT,
  last_customer_msg_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_bot_msg_at TIMESTAMP WITH TIME ZONE,
  last_follow_up_step INTEGER NOT NULL DEFAULT 0, -- quantos follow-ups já foram enviados
  follow_up_paused BOOLEAN NOT NULL DEFAULT false, -- se o lead respondeu, pausar
  lead_id UUID REFERENCES public.leads_raw(id),
  ai_config_id UUID REFERENCES public.ai_configs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, instance_name, remote_jid)
);

-- Enable RLS
ALTER TABLE public.follow_up_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tracker ENABLE ROW LEVEL SECURITY;

-- RLS for follow_up_rules
CREATE POLICY "Org members can view follow-up rules" ON public.follow_up_rules FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can create follow-up rules" ON public.follow_up_rules FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update follow-up rules" ON public.follow_up_rules FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete follow-up rules" ON public.follow_up_rules FOR DELETE USING (is_org_member(org_id));

-- RLS for conversation_tracker
CREATE POLICY "Org members can view conversations" ON public.conversation_tracker FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can manage conversations" ON public.conversation_tracker FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update conversations" ON public.conversation_tracker FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete conversations" ON public.conversation_tracker FOR DELETE USING (is_org_member(org_id));

-- Triggers
CREATE TRIGGER update_follow_up_rules_updated_at BEFORE UPDATE ON public.follow_up_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversation_tracker_updated_at BEFORE UPDATE ON public.conversation_tracker FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_conversation_tracker_org ON public.conversation_tracker(org_id);
CREATE INDEX idx_conversation_tracker_follow_up ON public.conversation_tracker(follow_up_paused, last_customer_msg_at);
CREATE INDEX idx_follow_up_rules_config ON public.follow_up_rules(ai_config_id);
