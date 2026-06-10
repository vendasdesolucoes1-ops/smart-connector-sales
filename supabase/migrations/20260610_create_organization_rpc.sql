-- Atomic onboarding: create organization, link profile, grant admin role
-- and seed default CRM stages in a single SECURITY DEFINER function.
-- Avoids the RLS circular dependency where the user_roles INSERT policy
-- (is_org_admin) requires an admin row that doesn't exist yet.

CREATE OR REPLACE FUNCTION public.create_organization_for_user(org_name TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF org_name IS NULL OR length(trim(org_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  -- Guard: user must not already belong to an organization
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND org_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  -- Create organization
  INSERT INTO public.organizations (name, owner_id)
  VALUES (trim(org_name), auth.uid())
  RETURNING id INTO new_org_id;

  -- Link profile (create it if the signup trigger row is missing)
  UPDATE public.profiles
  SET org_id = new_org_id
  WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, org_id) VALUES (auth.uid(), new_org_id);
  END IF;

  -- Grant admin role (SECURITY DEFINER bypasses the is_org_admin RLS check)
  INSERT INTO public.user_roles (user_id, org_id, role)
  VALUES (auth.uid(), new_org_id, 'admin');

  -- Seed default CRM pipeline stages (matches PIPELINE_STAGE_DEFAULTS in the app)
  INSERT INTO public.crm_stages (org_id, name, stage_order, stage_key)
  VALUES
    (new_org_id, 'Lead', 0, 'lead'),
    (new_org_id, 'Enriquecidas', 1, 'enriched'),
    (new_org_id, 'Contato Feito', 2, 'contacted'),
    (new_org_id, 'Em Prospecção', 3, 'prospecting'),
    (new_org_id, 'Qualificado', 4, 'qualified'),
    (new_org_id, 'Agendado', 5, 'scheduled'),
    (new_org_id, 'Reunião/Proposta', 6, 'meeting'),
    (new_org_id, 'Ganho', 7, 'won'),
    (new_org_id, 'Perdido', 8, 'lost');

  RETURN json_build_object('org_id', new_org_id, 'success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_for_user(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_for_user(TEXT) TO authenticated;
