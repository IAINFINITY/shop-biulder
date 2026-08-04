-- Admin/support RPCs aligned to the clinic+b2b tables.
-- The frontend already calls these function names; the new database needs the
-- implementations to point at the renamed tables.

DROP FUNCTION IF EXISTS public.list_admin_users();
CREATE FUNCTION public.list_admin_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  role text,
  is_active boolean,
  created_at timestamptz,
  permissions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
    SELECT
      ur.user_id,
      au.email::text,
      COALESCE(ad.display_name, '')::text,
      ur.role,
      COALESCE(ad.is_active, true),
      au.created_at,
      ad.permissions
    FROM public."clinic+b2b_user_roles" ur
    JOIN auth.users au ON au.id = ur.user_id
    LEFT JOIN public."clinic+b2b_admin_users" ad ON ad.user_id = ur.user_id
    WHERE ur.role IN (
      'superadmin',
      'admin',
      'consultor',
      'representante',
      'admin_atendimento'
    )
    ORDER BY au.email, ur.role;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_admin_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_role NOT IN (
    'superadmin',
    'admin',
    'consultor',
    'representante',
    'admin_atendimento',
    'user'
  ) THEN
    RAISE EXCEPTION 'Role invalida';
  END IF;

  DELETE FROM public."clinic+b2b_user_roles"
  WHERE user_id = p_user_id
    AND role IN (
      'superadmin',
      'admin',
      'consultor',
      'representante',
      'admin_atendimento'
    );

  IF p_role <> 'user' THEN
    INSERT INTO public."clinic+b2b_user_roles" (user_id, role)
    VALUES (p_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public."clinic+b2b_user_roles" (user_id, role)
  VALUES (p_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_admin_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_admin_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_admin_active(p_user_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public."clinic+b2b_admin_users" (user_id, display_name, is_active)
  VALUES (p_user_id, '', p_active)
  ON CONFLICT (user_id)
  DO UPDATE SET is_active = p_active, updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.toggle_admin_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_admin_active(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_admin_permissions(
  p_user_id uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public."clinic+b2b_admin_users" (user_id, permissions)
  VALUES (p_user_id, p_permissions)
  ON CONFLICT (user_id) DO UPDATE
    SET permissions = EXCLUDED.permissions,
        updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.update_admin_permissions(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_admin_permissions(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_admin_display_name(
  p_user_id uuid,
  p_display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public."clinic+b2b_admin_users" (user_id, display_name)
  VALUES (p_user_id, NULLIF(TRIM(p_display_name), ''))
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.update_admin_display_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_admin_display_name(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_internal_staff_role(p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email invalido';
  END IF;

  IF p_role NOT IN (
    'user',
    'superadmin',
    'admin',
    'consultor',
    'representante',
    'admin_atendimento'
  ) THEN
    RAISE EXCEPTION 'Role invalida';
  END IF;

  SELECT id
    INTO v_user_id
    FROM auth.users
   WHERE lower(email) = v_email
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado';
  END IF;

  DELETE FROM public."clinic+b2b_user_roles"
   WHERE user_id = v_user_id
     AND role IN (
       'superadmin',
       'admin',
       'consultor',
       'representante',
       'admin_atendimento'
     );

  IF p_role <> 'user' THEN
    INSERT INTO public."clinic+b2b_user_roles" (user_id, role)
    VALUES (v_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_internal_staff_role(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_internal_staff_role(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_internal_staff()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
    SELECT
      ur.user_id,
      au.email::text,
      ur.role,
      au.created_at
    FROM public."clinic+b2b_user_roles" ur
    JOIN auth.users au ON au.id = ur.user_id
    WHERE ur.role IN (
      'superadmin',
      'admin',
      'consultor',
      'representante',
      'admin_atendimento'
    )
    ORDER BY au.email, ur.role;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_internal_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_internal_staff() TO authenticated;
