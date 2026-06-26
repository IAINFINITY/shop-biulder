-- -------------------------------------------------------------
-- Atribui a role de admin para a conta administrativa principal
-- Execute no SQL Editor do Supabase após confirmar o e-mail abaixo.
-- -------------------------------------------------------------

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'clinicmaisadmin@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
