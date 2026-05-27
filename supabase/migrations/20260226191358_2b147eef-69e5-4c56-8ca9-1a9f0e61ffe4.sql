
-- ══════ INTEGRATIONS: allow all org members ══════
DROP POLICY "Admins can create integrations" ON public.integrations;
DROP POLICY "Admins can update integrations" ON public.integrations;
DROP POLICY "Admins can delete integrations" ON public.integrations;

CREATE POLICY "Org members can create integrations"
ON public.integrations FOR INSERT
WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org members can update integrations"
ON public.integrations FOR UPDATE
USING (is_org_member(org_id));

CREATE POLICY "Org members can delete integrations"
ON public.integrations FOR DELETE
USING (is_org_member(org_id));

-- ══════ AI_CONFIGS: allow all org members ══════
DROP POLICY "Admins can create AI configs" ON public.ai_configs;
DROP POLICY "Admins can update AI configs" ON public.ai_configs;
DROP POLICY "Admins can delete AI configs" ON public.ai_configs;

CREATE POLICY "Org members can create AI configs"
ON public.ai_configs FOR INSERT
WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org members can update AI configs"
ON public.ai_configs FOR UPDATE
USING (is_org_member(org_id));

CREATE POLICY "Org members can delete AI configs"
ON public.ai_configs FOR DELETE
USING (is_org_member(org_id));

-- ══════ AI_KNOWLEDGE_DOCS: allow all org members ══════
DROP POLICY "Admins can create knowledge docs" ON public.ai_knowledge_docs;
DROP POLICY "Admins can update knowledge docs" ON public.ai_knowledge_docs;
DROP POLICY "Admins can delete knowledge docs" ON public.ai_knowledge_docs;

CREATE POLICY "Org members can create knowledge docs"
ON public.ai_knowledge_docs FOR INSERT
WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org members can update knowledge docs"
ON public.ai_knowledge_docs FOR UPDATE
USING (is_org_member(org_id));

CREATE POLICY "Org members can delete knowledge docs"
ON public.ai_knowledge_docs FOR DELETE
USING (is_org_member(org_id));
