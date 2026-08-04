-- Reaplica ao banco novo (tabelas clinic+b2b_) as funções/RPCs que o
-- frontend ainda usa e que não existiam no projeto de origem renomeado.
-- Originais: 20260528140000_proxis_import_id, 20260701150000_support_chat,
-- 20260714124500_update_own_customer_profile_cnpj,
-- 20260714140000_check_auth_email_exists,
-- 20260722190000_fix_sync_customer_proxis_link_fk

-- =====================================================================
-- 1) allocate_proxis_import_id (proxis_import_id_seq)
--    A coluna proxis_import_id já existe em clinic+b2b_orders.
-- =====================================================================
CREATE SEQUENCE IF NOT EXISTS public.proxis_import_id_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.allocate_proxis_import_id(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id INTEGER;
  new_id INTEGER;
BEGIN
  SELECT proxis_import_id INTO existing_id
  FROM public."clinic+b2b_orders"
  WHERE id = p_order_id;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  new_id := nextval('public.proxis_import_id_seq');
  UPDATE public."clinic+b2b_orders"
  SET proxis_import_id = new_id
  WHERE id = p_order_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_proxis_import_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_proxis_import_id(UUID) TO authenticated;

-- =====================================================================
-- 2) sync_customer_proxis_link
--    Requer UNIQUE em clinic+b2b_price_tables.tpr_id (não existia).
-- =====================================================================
ALTER TABLE public."clinic+b2b_price_tables"
  ADD CONSTRAINT clinic_b2b_price_tables_tpr_id_unique UNIQUE (tpr_id);

DROP FUNCTION IF EXISTS public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.sync_customer_proxis_link(
  p_proxis_pes_id INTEGER DEFAULT NULL,
  p_proxis_tpr_id INTEGER DEFAULT NULL,
  p_proxis_found BOOLEAN DEFAULT false,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_user_id IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem sincronizar para outro usuario';
  END IF;

  IF p_proxis_tpr_id IS NOT NULL THEN
    INSERT INTO public."clinic+b2b_price_tables" (tpr_id, name, active)
    VALUES (p_proxis_tpr_id, 'Tabela Proxis #' || p_proxis_tpr_id, true)
    ON CONFLICT (tpr_id) DO NOTHING;
  END IF;

  UPDATE public."clinic+b2b_customer_profiles"
  SET
    proxis_pes_id = p_proxis_pes_id,
    proxis_tpr_id = p_proxis_tpr_id,
    proxis_found = COALESCE(p_proxis_found, false),
    proxis_synced_at = now(),
    updated_at = now()
  WHERE user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN, UUID) TO authenticated;

-- =====================================================================
-- 3) ensure_support_conversation + triggers do chat
--    Requer UNIQUE em clinic+b2b_support_conversations.customer_user_id.
--    Tabelas/policies já existem; só recriam funções e triggers.
-- =====================================================================
ALTER TABLE public."clinic+b2b_support_conversations"
  ADD CONSTRAINT support_conversations_customer_unique UNIQUE (customer_user_id);

CREATE OR REPLACE FUNCTION public.ensure_support_conversation(p_subject TEXT DEFAULT 'Atendimento')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_conversation_id UUID;
  v_subject TEXT := COALESCE(NULLIF(trim(p_subject), ''), 'Atendimento');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT
    cp.name,
    cp.company,
    cp.phone,
    cp.cnpj
  INTO v_profile
  FROM public."clinic+b2b_customer_profiles" cp
  WHERE cp.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cliente não encontrado';
  END IF;

  INSERT INTO public."clinic+b2b_support_conversations" (
    customer_user_id,
    customer_name,
    customer_company,
    customer_phone,
    customer_cnpj,
    subject
  )
  VALUES (
    v_user_id,
    trim(v_profile.name),
    NULLIF(trim(v_profile.company), ''),
    NULLIF(trim(v_profile.phone), ''),
    NULLIF(trim(v_profile.cnpj), ''),
    v_subject
  )
  ON CONFLICT (customer_user_id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_company = EXCLUDED.customer_company,
    customer_phone = EXCLUDED.customer_phone,
    customer_cnpj = EXCLUDED.customer_cnpj,
    subject = EXCLUDED.subject,
    updated_at = now()
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_support_conversation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_support_conversation(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_support_conversation_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public."clinic+b2b_support_conversations"
  SET
    last_message_at = NEW.created_at,
    last_message_preview = left(regexp_replace(trim(NEW.body), '\s+', ' ', 'g'), 140),
    assigned_admin_id = CASE
      WHEN NEW.sender_role = 'admin' AND assigned_admin_id IS NULL THEN NEW.sender_user_id
      ELSE assigned_admin_id
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_touch_conversation ON public."clinic+b2b_support_messages";
CREATE TRIGGER support_messages_touch_conversation
  AFTER INSERT ON public."clinic+b2b_support_messages"
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

DROP TRIGGER IF EXISTS support_conversations_updated_at ON public."clinic+b2b_support_conversations";
CREATE TRIGGER support_conversations_updated_at
  BEFORE UPDATE ON public."clinic+b2b_support_conversations"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_conversations_updated_at();

DROP TRIGGER IF EXISTS support_messages_updated_at ON public."clinic+b2b_support_messages";
CREATE TRIGGER support_messages_updated_at
  BEFORE UPDATE ON public."clinic+b2b_support_messages"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_conversations_updated_at();

-- =====================================================================
-- 4) update_own_customer_profile
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_own_customer_profile(
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_cnpj TEXT DEFAULT NULL,
  p_address_cep TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_complement TEXT DEFAULT NULL,
  p_address_neighborhood TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_address_ibge TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cnpj TEXT;
  v_customer_type TEXT;
  v_override_type TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT customer_type
    INTO v_customer_type
    FROM public."clinic+b2b_customer_profiles"
   WHERE user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cliente nao encontrado';
  END IF;

  IF p_cnpj IS NOT NULL THEN
    v_cnpj := regexp_replace(p_cnpj, '\D', '', 'g');
    IF length(v_cnpj) NOT IN (11, 14) THEN
      RAISE EXCEPTION 'CNPJ invalido';
    END IF;

    SELECT customer_type
      INTO v_override_type
      FROM public."clinic+b2b_customer_type_overrides"
     WHERE cnpj = v_cnpj
     LIMIT 1;

    IF v_override_type IS NOT NULL THEN
      v_customer_type := lower(trim(v_override_type));
    END IF;
  END IF;

  UPDATE public."clinic+b2b_customer_profiles"
  SET
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    company = COALESCE(NULLIF(trim(p_company), ''), company),
    cnpj = COALESCE(v_cnpj, cnpj),
    customer_type = v_customer_type,
    address_cep = COALESCE(p_address_cep, address_cep),
    address_street = COALESCE(p_address_street, address_street),
    address_number = COALESCE(p_address_number, address_number),
    address_complement = COALESCE(p_address_complement, address_complement),
    address_neighborhood = COALESCE(p_address_neighborhood, address_neighborhood),
    address_city = COALESCE(p_address_city, address_city),
    address_state = COALESCE(p_address_state, address_state),
    address_ibge = COALESCE(p_address_ibge, address_ibge),
    updated_at = now()
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cliente nao encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =====================================================================
-- 5) check_auth_email_exists
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_auth_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.check_auth_email_exists(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_auth_email_exists(text) TO anon, authenticated;
