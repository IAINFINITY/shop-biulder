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
    FROM public.customer_profiles
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
      FROM public.customer_type_overrides
     WHERE cnpj = v_cnpj
     LIMIT 1;

    IF v_override_type IS NOT NULL THEN
      v_customer_type := lower(trim(v_override_type));
    END IF;
  END IF;

  UPDATE public.customer_profiles
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
