CREATE OR REPLACE FUNCTION public.handle_new_customer_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_role TEXT := lower(trim(coalesce(NEW.raw_app_meta_data->>'role', '')));
  v_name TEXT := trim(coalesce(NEW.raw_user_meta_data->>'name', ''));
  v_phone TEXT := trim(coalesce(NEW.raw_user_meta_data->>'phone', ''));
  v_company TEXT := trim(coalesce(NEW.raw_user_meta_data->>'company', ''));
  v_cnpj TEXT := regexp_replace(coalesce(NEW.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g');
  v_linked_company_cnpj TEXT := regexp_replace(coalesce(NEW.raw_user_meta_data->>'linked_company_cnpj', ''), '\D', '', 'g');
  v_customer_type TEXT := lower(trim(coalesce(NEW.raw_user_meta_data->>'customer_type', 'cliente')));
  v_override_type TEXT;
BEGIN
  IF v_app_role IN (
    'admin',
    'superadmin',
    'consultor',
    'representante',
    'admin_atendimento'
  ) THEN
    RETURN NEW;
  END IF;

  IF v_name = '' OR v_phone = '' OR v_company = '' THEN
    RETURN NEW;
  END IF;

  IF v_customer_type = 'funcionario' THEN
    IF length(v_cnpj) <> 11 THEN
      RAISE EXCEPTION 'Documento inválido';
    END IF;

    IF length(v_linked_company_cnpj) <> 14 THEN
      RAISE EXCEPTION 'CNPJ da empresa vinculada inválido';
    END IF;
  ELSE
    IF length(v_cnpj) <> 14 THEN
      RAISE EXCEPTION 'CNPJ inválido';
    END IF;

    IF v_customer_type NOT IN ('cliente', 'lojista', 'distribuidor') THEN
      v_customer_type := 'cliente';
    END IF;

    SELECT customer_type
      INTO v_override_type
      FROM public.customer_type_overrides
     WHERE cnpj = v_cnpj
     LIMIT 1;

    IF v_override_type IS NOT NULL THEN
      v_customer_type := lower(trim(v_override_type));
    END IF;

    v_linked_company_cnpj := NULL;
  END IF;

  INSERT INTO public.customer_profiles (
    user_id,
    name,
    phone,
    company,
    cnpj,
    customer_type,
    linked_company_cnpj,
    address_cep,
    address_street,
    address_number,
    address_complement,
    address_neighborhood,
    address_city,
    address_state,
    address_ibge
  )
  VALUES (
    NEW.id,
    v_name,
    v_phone,
    v_company,
    v_cnpj,
    v_customer_type,
    v_linked_company_cnpj,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    company = EXCLUDED.company,
    cnpj = EXCLUDED.cnpj,
    customer_type = EXCLUDED.customer_type,
    linked_company_cnpj = EXCLUDED.linked_company_cnpj,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer_auth_user();
