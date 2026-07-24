-- Admin permissions: coluna JSONB para controle granular de seções

-- 1. Adicionar coluna permissions na admin_users
ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

COMMENT ON COLUMN public.admin_users.permissions IS
  'Mapa de permissoes: {"dashboard":true,"produtos":false,...}. NULL = todas liberadas (compatibilidade retroativa).';

-- 2. Atualizar list_admin_users para incluir permissions
CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role public.app_role,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  permissions JSONB
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
      au.created_at,
      ad.permissions
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

-- 3. RPC para atualizar permissoes de um admin
CREATE OR REPLACE FUNCTION public.update_admin_permissions(p_user_id UUID, p_permissions JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.admin_users (user_id, display_name, is_active, permissions)
  VALUES (p_user_id, '', true, p_permissions)
  ON CONFLICT (user_id)
  DO UPDATE SET permissions = p_permissions, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_permissions(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_admin_permissions(UUID, JSONB) TO authenticated;