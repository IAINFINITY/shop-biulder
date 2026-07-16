ALTER TABLE public.customer_profiles
ADD COLUMN linked_company_cnpj TEXT DEFAULT NULL;

ALTER TABLE public.customer_type_overrides
DROP CONSTRAINT IF EXISTS customer_type_overrides_customer_type_check;

ALTER TABLE public.customer_type_overrides
ADD CONSTRAINT customer_type_overrides_customer_type_check
CHECK (customer_type IN ('cliente', 'lojista', 'distribuidor', 'funcionario'));

CREATE OR REPLACE FUNCTION public.register_customer_profile(
  p_name TEXT,
  p_phone TEXT,
  p_company TEXT,
  p_cnpj TEXT,
  p_customer_type TEXT,
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

  v_cnpj := regexp_replace(p_cnpj, '\D', '', 'g');
  IF length(v_cnpj) <> 14 THEN
    RAISE EXCEPTION 'CNPJ invalido';
  END IF;

  v_customer_type := lower(trim(coalesce(p_customer_type, 'cliente')));
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

  INSERT INTO public.customer_profiles (
    user_id, name, phone, company, cnpj, customer_type,
    address_cep, address_street, address_number, address_complement,
    address_neighborhood, address_city, address_state, address_ibge
  )
  VALUES (
    v_user_id, trim(p_name), trim(p_phone), trim(p_company), v_cnpj, v_customer_type,
    coalesce(trim(p_address_cep), ''), coalesce(trim(p_address_street), ''), coalesce(trim(p_address_number), ''), coalesce(trim(p_address_complement), ''),
    coalesce(trim(p_address_neighborhood), ''), coalesce(trim(p_address_city), ''), coalesce(trim(p_address_state), ''), coalesce(trim(p_address_ibge), '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    company = EXCLUDED.company,
    cnpj = EXCLUDED.cnpj,
    customer_type = EXCLUDED.customer_type,
    address_cep = EXCLUDED.address_cep,
    address_street = EXCLUDED.address_street,
    address_number = EXCLUDED.address_number,
    address_complement = EXCLUDED.address_complement,
    address_neighborhood = EXCLUDED.address_neighborhood,
    address_city = EXCLUDED.address_city,
    address_state = EXCLUDED.address_state,
    address_ibge = EXCLUDED.address_ibge,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
