-- Invitation-only access system.
-- Closed signup: new accounts can only be created by accepting a pending
-- invitation created by a platform super admin.

-- Platform-level super admins (not org-scoped, so a separate table is used
-- instead of overloading user_roles, whose org_id column is NOT NULL).
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE POLICY "Super admins can view platform_admins" ON public.platform_admins
  FOR SELECT USING (public.is_super_admin());

-- Invitations
CREATE TABLE public.invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  invited_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view invitations" ON public.invitations
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Super admins can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (public.is_super_admin() AND invited_by = auth.uid());

-- Helper used by AuthContext to gate access: true when the given email has
-- a used, non-expired invitation, or the user is a platform super admin.
CREATE OR REPLACE FUNCTION public.has_valid_invitation(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.invitations i
      JOIN auth.users u ON u.email = i.email
      WHERE u.id = p_user_id AND i.used_at IS NOT NULL
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_valid_invitation(UUID) TO authenticated;

-- Create an invitation. Restricted to super admins via the function body
-- (not just RLS) so it can also be called safely from edge functions.
CREATE OR REPLACE FUNCTION public.create_invitation(p_email TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_invite public.invitations;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  INSERT INTO public.invitations (email, invited_by)
  VALUES (lower(trim(p_email)), auth.uid())
  ON CONFLICT (email) DO UPDATE
    SET token = gen_random_uuid()::text,
        used_at = NULL,
        expires_at = now() + interval '7 days',
        invited_by = auth.uid(),
        created_at = now()
  RETURNING * INTO new_invite;

  RETURN json_build_object(
    'id', new_invite.id,
    'email', new_invite.email,
    'token', new_invite.token,
    'expires_at', new_invite.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(TEXT) TO authenticated;

-- Mark an invitation as used right after the invitee's account is created
-- on the client (via supabase.auth.signUp). SECURITY DEFINER bypasses RLS
-- since the brand-new user has no rows of their own yet.
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite public.invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO invite FROM public.invitations WHERE token = p_token;

  IF invite IS NULL THEN
    RAISE EXCEPTION 'Convite inválido';
  END IF;

  IF invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Convite já utilizado';
  END IF;

  IF invite.expires_at < now() THEN
    RAISE EXCEPTION 'Convite expirado';
  END IF;

  IF lower(invite.email) <> lower((SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Este convite não pertence a este email';
  END IF;

  UPDATE public.invitations SET used_at = now() WHERE token = p_token;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;

-- Lookup an invitation by token without requiring auth, so the /invite/:token
-- page can show the invited email before the user signs up. Only exposes
-- the minimum needed fields.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite public.invitations;
BEGIN
  SELECT * INTO invite FROM public.invitations WHERE token = p_token;

  IF invite IS NULL THEN
    RETURN json_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF invite.used_at IS NOT NULL THEN
    RETURN json_build_object('valid', false, 'reason', 'used');
  END IF;

  IF invite.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'reason', 'expired');
  END IF;

  RETURN json_build_object('valid', true, 'email', invite.email);
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon, authenticated;
