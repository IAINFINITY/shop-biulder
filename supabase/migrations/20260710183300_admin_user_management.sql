-- Gestão de Usuários ADM: tabela de metadados, RPCs e policies

-- 1. Tabela de metadados dos usuários admin
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_select ON public.admin_users
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY admin_users_insert ON public.admin_users
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY admin_users_update ON public.admin_users
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- 2. Atualizar has_role para incluir superadmin ao checar admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (
          _role = 'admin'::public.app_role
          AND role IN ('superadmin'::public.app_role, 'admin'::public.app_role, 'consultor'::public.app_role, 'representante'::public.app_role, 'admin_atendimento'::public.app_role)
        )
      )
  );
$$;

-- 3. Listar todos os usuários admin (apenas superadmin)
CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role public.app_role,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
    SELECT
      ur.user_id,
      au.email::TEXT,
      COALESCE(ad.display_name, '')::TEXT,
      ur.role,
      COALESCE(ad.is_active, true),
      au.created_at
    FROM public.user_roles ur
    JOIN auth.users au ON au.id = ur.user_id
    LEFT JOIN public.admin_users ad ON ad.user_id = ur.user_id
    WHERE ur.role IN (
      'superadmin'::public.app_role,
      'admin'::public.app_role,
      'consultor'::public.app_role,
      'representante'::public.app_role,
      'admin_atendimento'::public.app_role
    )
    ORDER BY au.email, ur.role;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;

-- 4. Alterar papel de um usuário admin (apenas superadmin)
CREATE OR REPLACE FUNCTION public.update_admin_role(p_user_id UUID, p_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_role NOT IN (
    'superadmin'::public.app_role,
    'admin'::public.app_role,
    'consultor'::public.app_role,
    'representante'::public.app_role,
    'admin_atendimento'::public.app_role,
    'user'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Role invalida';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
    AND role IN (
      'superadmin'::public.app_role,
      'admin'::public.app_role,
      'consultor'::public.app_role,
      'representante'::public.app_role,
      'admin_atendimento'::public.app_role
    );

  IF p_role <> 'user'::public.app_role THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_admin_role(UUID, public.app_role) TO authenticated;

-- 5. Ativar/desativar usuário admin (apenas superadmin)
CREATE OR REPLACE FUNCTION public.toggle_admin_active(p_user_id UUID, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.admin_users (user_id, display_name, is_active)
  VALUES (p_user_id, '', p_active)
  ON CONFLICT (user_id)
  DO UPDATE SET is_active = p_active, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_admin_active(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_admin_active(UUID, BOOLEAN) TO authenticated;

-- 6. Definir nome de exibição de admin
CREATE OR REPLACE FUNCTION public.set_admin_display_name(p_user_id UUID, p_display_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.admin_users (user_id, display_name)
  VALUES (p_user_id, p_display_name)
  ON CONFLICT (user_id)
  DO UPDATE SET display_name = p_display_name, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_admin_display_name(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_admin_display_name(UUID, TEXT) TO authenticated;

-- 7. Atualizar set_internal_staff_role para aceitar superadmin
CREATE OR REPLACE FUNCTION public.set_internal_staff_role(p_email TEXT, p_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email invalido';
  END IF;

  IF p_role NOT IN (
    'user'::public.app_role,
    'superadmin'::public.app_role,
    'admin'::public.app_role,
    'consultor'::public.app_role,
    'representante'::public.app_role,
    'admin_atendimento'::public.app_role
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

  DELETE FROM public.user_roles
   WHERE user_id = v_user_id
     AND role IN (
       'superadmin'::public.app_role,
       'admin'::public.app_role,
       'consultor'::public.app_role,
       'representante'::public.app_role,
       'admin_atendimento'::public.app_role
     );

  IF p_role <> 'user'::public.app_role THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_internal_staff_role(TEXT, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_internal_staff_role(TEXT, public.app_role) TO authenticated;

-- 8. Atualizar list_internal_staff para incluir superadmin
CREATE OR REPLACE FUNCTION public.list_internal_staff()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role public.app_role,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
    SELECT
      ur.user_id,
      au.email::TEXT,
      ur.role,
      au.created_at
    FROM public.user_roles ur
    JOIN auth.users au ON au.id = ur.user_id
    WHERE ur.role IN (
      'superadmin'::public.app_role,
      'admin'::public.app_role,
      'consultor'::public.app_role,
      'representante'::public.app_role,
      'admin_atendimento'::public.app_role
    )
    ORDER BY au.email, ur.role;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_internal_staff() TO authenticated;

-- 9. Seed admin_users para clinicmaisadmin
INSERT INTO public.admin_users (user_id, display_name, is_active)
SELECT id, 'Superadmin', true
FROM auth.users
WHERE email = 'clinicmaisadmin@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
