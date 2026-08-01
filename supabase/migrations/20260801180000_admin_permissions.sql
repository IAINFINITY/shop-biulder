BEGIN;

-- Permissoes de admin: passam a existir de verdade.
--
-- A tela de usuarios sempre mostrou uma lista de caixas por secao, mas nao havia
-- onde guardar a escolha: `admin_users` nao tinha a coluna, `list_admin_users()`
-- nao devolvia o campo e `update_admin_permissions` nunca foi criada. O front
-- fazia `user.permissions ?? allPermissions()`, entao **todo admin recebia todas
-- as permissoes** e as caixas eram decorativas.

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS permissions JSONB;

COMMENT ON COLUMN public.admin_users.permissions IS
  'Mapa secao -> booleano. NULL = acesso total (comportamento anterior a esta coluna).';

-- `list_admin_users` ganha a coluna nova. O resto do corpo e o original.
--
-- Precisa de DROP: o Postgres nao deixa `CREATE OR REPLACE` mudar o tipo de
-- retorno de uma funcao que devolve TABLE. Dentro da transacao abaixo, nao ha
-- instante em que a funcao esteja ausente para quem esta usando o painel.
DROP FUNCTION IF EXISTS public.list_admin_users();

CREATE FUNCTION public.list_admin_users()
 RETURNS TABLE(
   user_id uuid,
   email text,
   display_name text,
   role app_role,
   is_active boolean,
   created_at timestamp with time zone,
   permissions jsonb
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Gravar permissoes. So o superadmin, como nas demais operacoes desta tela.
CREATE OR REPLACE FUNCTION public.update_admin_permissions(
  p_user_id uuid,
  p_permissions jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- A linha em `admin_users` pode nao existir: ela so nasce quando alguem edita
  -- o usuario. Sem o upsert, salvar permissao de um admin recem-criado nao
  -- gravaria nada e tambem nao daria erro.
  INSERT INTO public.admin_users (user_id, permissions)
  VALUES (p_user_id, p_permissions)
  ON CONFLICT (user_id) DO UPDATE
    SET permissions = EXCLUDED.permissions,
        updated_at = now();
END;
$function$;

-- Editar o nome exibido.
--
-- Pedido do dono: o email pode trocar de dono, e a pessoa pode mudar de setor ou
-- sair. Sem poder editar o nome, a lista de usuarios envelhece e deixa de dizer
-- quem e quem.
CREATE OR REPLACE FUNCTION public.update_admin_display_name(
  p_user_id uuid,
  p_display_name text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.admin_users (user_id, display_name)
  VALUES (p_user_id, NULLIF(TRIM(p_display_name), ''))
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = now();
END;
$function$;

COMMIT;
