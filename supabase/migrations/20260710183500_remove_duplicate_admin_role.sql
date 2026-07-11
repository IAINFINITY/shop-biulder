-- Remove a role 'admin' duplicada do clinicmaisadmin (deve ficar só superadmin)
DELETE FROM public.user_roles
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'clinicmaisadmin@gmail.com')
  AND role = 'admin'::public.app_role;
