-- Papéis internos de atendimento e suporte: funções, tabelas auxiliares e chat typing.

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
          AND role IN ('admin'::public.app_role, 'consultor'::public.app_role, 'representante'::public.app_role, 'admin_atendimento'::public.app_role)
        )
      )
  );
$$;

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
    RAISE EXCEPTION 'Email inválido';
  END IF;

  IF p_role NOT IN (
    'user'::public.app_role,
    'admin'::public.app_role,
    'consultor'::public.app_role,
    'representante'::public.app_role,
    'admin_atendimento'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Role inválida';
  END IF;

  SELECT id
    INTO v_user_id
    FROM auth.users
   WHERE lower(email) = v_email
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = v_user_id
     AND role IN (
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
      au.email,
      ur.role,
      au.created_at
    FROM public.user_roles ur
    JOIN auth.users au ON au.id = ur.user_id
    WHERE ur.role IN (
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

ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS customer_typing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_typing_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.touch_support_conversation_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = left(regexp_replace(trim(NEW.body), '\s+', ' ', 'g'), 140),
    customer_typing_at = CASE
      WHEN NEW.sender_role = 'customer' THEN NULL
      ELSE customer_typing_at
    END,
    admin_typing_at = CASE
      WHEN NEW.sender_role = 'admin' THEN NULL
      ELSE admin_typing_at
    END,
    assigned_admin_id = CASE
      WHEN NEW.sender_role = 'admin' AND assigned_admin_id IS NULL THEN NEW.sender_user_id
      ELSE assigned_admin_id
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_touch_conversation ON public.support_messages;
CREATE TRIGGER support_messages_touch_conversation
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_support_conversation_from_message();

CREATE OR REPLACE FUNCTION public.update_support_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_conversations_updated_at ON public.support_conversations;
CREATE TRIGGER support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_conversations_updated_at();

DROP TRIGGER IF EXISTS support_messages_updated_at ON public.support_messages;
CREATE TRIGGER support_messages_updated_at
  BEFORE UPDATE ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_conversations_updated_at();