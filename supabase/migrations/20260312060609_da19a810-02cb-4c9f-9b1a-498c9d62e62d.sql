
CREATE TABLE public.contact_cooldown (
  phone TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id),
  last_contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  PRIMARY KEY (phone, org_id)
);

CREATE INDEX idx_contact_cooldown_lookup 
ON public.contact_cooldown (phone, org_id, last_contacted_at);

ALTER TABLE public.contact_cooldown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orgs can manage own cooldowns"
ON public.contact_cooldown
FOR ALL
USING (is_org_member(org_id));
