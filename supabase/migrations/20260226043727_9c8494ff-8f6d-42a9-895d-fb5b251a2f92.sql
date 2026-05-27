
-- Tabela principal de campanhas/disparos
CREATE TABLE public.broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'automated')),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'sms')),
  
  -- Segmentação
  segment_source TEXT[] DEFAULT '{}',  -- 'web', 'whatsapp', 'manual', 'import', 'all'
  segment_status TEXT[] DEFAULT '{}',  -- 'pending', 'enriched', 'converted'
  segment_tags TEXT[] DEFAULT '{}',
  segment_date_from TIMESTAMP WITH TIME ZONE,
  segment_date_to TIMESTAMP WITH TIME ZONE,
  segment_custom_filter JSONB DEFAULT '{}',
  
  -- IA & Agente
  ai_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_config_id UUID REFERENCES public.ai_configs(id),
  instance_name TEXT,  -- instância WhatsApp vinculada
  
  -- Mensagem
  message_template TEXT,
  message_variables JSONB DEFAULT '{}',
  follow_up_enabled BOOLEAN DEFAULT false,
  follow_up_count INTEGER DEFAULT 3,
  follow_up_interval_hours INTEGER DEFAULT 24,
  
  -- Agendamento
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Métricas
  total_leads INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Cadência
  send_rate_per_minute INTEGER DEFAULT 5,
  delay_between_messages INTEGER DEFAULT 10,  -- segundos
  
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de leads vinculados a cada campanha
CREATE TABLE public.broadcast_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'converted', 'failed', 'skipped')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  message_sent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, lead_id)
);

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcasts
CREATE POLICY "Org members can view broadcasts" ON public.broadcasts FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can create broadcasts" ON public.broadcasts FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update broadcasts" ON public.broadcasts FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete broadcasts" ON public.broadcasts FOR DELETE USING (is_org_member(org_id));

-- RLS policies for broadcast_leads (inherit from parent broadcast)
CREATE POLICY "Org members can view broadcast leads" ON public.broadcast_leads FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.broadcasts b WHERE b.id = broadcast_id AND is_org_member(b.org_id)));
CREATE POLICY "Org members can manage broadcast leads" ON public.broadcast_leads FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.broadcasts b WHERE b.id = broadcast_id AND is_org_member(b.org_id)));
CREATE POLICY "Org members can update broadcast leads" ON public.broadcast_leads FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.broadcasts b WHERE b.id = broadcast_id AND is_org_member(b.org_id)));
CREATE POLICY "Org members can delete broadcast leads" ON public.broadcast_leads FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.broadcasts b WHERE b.id = broadcast_id AND is_org_member(b.org_id)));

-- Trigger for updated_at
CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON public.broadcasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_broadcasts_org_id ON public.broadcasts(org_id);
CREATE INDEX idx_broadcasts_status ON public.broadcasts(status);
CREATE INDEX idx_broadcast_leads_broadcast_id ON public.broadcast_leads(broadcast_id);
CREATE INDEX idx_broadcast_leads_lead_id ON public.broadcast_leads(lead_id);
CREATE INDEX idx_broadcast_leads_status ON public.broadcast_leads(status);
