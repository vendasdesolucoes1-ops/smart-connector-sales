
-- Tabela dedicada
CREATE TABLE public.integration_instances (
  instance_name TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  integration_id UUID NOT NULL REFERENCES integrations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.integration_instances ENABLE ROW LEVEL SECURITY;

-- Policy: service role pode inserir
CREATE POLICY "Service can insert instances" ON public.integration_instances
  FOR INSERT TO public WITH CHECK (true);

-- Policy: org members podem ver suas instâncias
CREATE POLICY "Org members can view instances" ON public.integration_instances
  FOR SELECT TO public USING (is_org_member(org_id));

-- Popular a partir de instances_by_user
INSERT INTO public.integration_instances (instance_name, org_id, integration_id)
SELECT DISTINCT inst.instance_name, i.org_id, i.id
FROM public.integrations i,
LATERAL (
  SELECT jsonb_array_elements_text(value) AS instance_name
  FROM jsonb_each(i.config->'instances_by_user')
) inst
WHERE i.service_name = 'evolution'
  AND inst.instance_name IS NOT NULL AND inst.instance_name != ''
ON CONFLICT (instance_name) DO NOTHING;

-- Popular a partir do array flat 'instances'
INSERT INTO public.integration_instances (instance_name, org_id, integration_id)
SELECT DISTINCT
  jsonb_array_elements_text(i.config->'instances') AS instance_name,
  i.org_id, i.id
FROM public.integrations i
WHERE i.service_name = 'evolution'
  AND i.config->'instances' IS NOT NULL
ON CONFLICT (instance_name) DO NOTHING;
