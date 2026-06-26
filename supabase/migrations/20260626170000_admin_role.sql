-- Atribui a role de admin para a conta administrativa principal.
-- Execute via `supabase db push` no projeto linkado.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'clinicmaisadmin@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
