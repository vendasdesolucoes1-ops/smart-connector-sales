
-- Clean up duplicate approval for user ee1c8c5d-6e83-4a4e-9548-13a7a13ddc48
-- Keep newest org (91441c3e), remove older duplicate (fb408a08)
DELETE FROM public.user_roles WHERE user_id='ee1c8c5d-6e83-4a4e-9548-13a7a13ddc48' AND org_id='fb408a08-4e21-4854-99cf-4affe231b7cc';
DELETE FROM public.crm_stages WHERE org_id='fb408a08-4e21-4854-99cf-4affe231b7cc';
DELETE FROM public.organizations WHERE id='fb408a08-4e21-4854-99cf-4affe231b7cc';

-- Ensure profile row exists and points at the kept org
INSERT INTO public.profiles (user_id, org_id, full_name)
VALUES ('ee1c8c5d-6e83-4a4e-9548-13a7a13ddc48', '91441c3e-27e4-485f-ae40-8661c62e385e', 'Danilo Fernandes')
ON CONFLICT (user_id) DO UPDATE SET org_id=EXCLUDED.org_id, full_name=COALESCE(public.profiles.full_name, EXCLUDED.full_name);

-- Mark invitation used for the approved user's email so InvitationGate lets them in
INSERT INTO public.invitations (email, used_at)
SELECT u.email, now() FROM auth.users u WHERE u.id='ee1c8c5d-6e83-4a4e-9548-13a7a13ddc48'
ON CONFLICT (email) DO UPDATE SET used_at=COALESCE(public.invitations.used_at, EXCLUDED.used_at);
