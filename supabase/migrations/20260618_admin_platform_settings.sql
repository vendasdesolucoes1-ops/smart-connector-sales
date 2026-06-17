-- Super admin module: platform-wide settings + WhatsApp instance status tracking.

-- 1. integration_instances: add status / phone_number, used by the new
--    one-instance-per-org WhatsApp connection flow and the super admin overview.
ALTER TABLE public.integration_instances
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. platform_settings: global infra credentials (Evolution API, Firecrawl,
-- HasData, Perplexity), editable only by super admins. Values are read/written
-- exclusively through SECURITY DEFINER RPCs below rather than direct table
-- access, since they hold API keys.
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins only" ON public.platform_settings
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.get_platform_settings()
RETURNS TABLE(key TEXT, value TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT s.key, s.value, s.updated_at FROM public.platform_settings s;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_platform_setting(p_key TEXT, p_value TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = p_value, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_setting(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_platform_setting(TEXT, TEXT) TO authenticated;

-- 3. Super admin overview: orgs + owner email + creation date + WhatsApp
-- instance status, plus aggregate counts. SECURITY DEFINER so it can read
-- across all orgs/auth.users without relaxing RLS for regular users.
CREATE OR REPLACE FUNCTION public.get_admin_overview()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'total_orgs', (SELECT count(*) FROM public.organizations),
    'total_users', (SELECT count(*) FROM auth.users),
    'total_connected_instances', (SELECT count(*) FROM public.integration_instances WHERE status = 'open'),
    'organizations', (
      SELECT coalesce(json_agg(row_to_json(o)), '[]'::json)
      FROM (
        SELECT
          org.id,
          org.name,
          owner.email AS owner_email,
          org.created_at,
          inst.instance_name,
          inst.status AS instance_status
        FROM public.organizations org
        LEFT JOIN auth.users owner ON owner.id = org.owner_id
        LEFT JOIN public.integration_instances inst ON inst.org_id = org.id
        ORDER BY org.created_at DESC
      ) o
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_overview() TO authenticated;
