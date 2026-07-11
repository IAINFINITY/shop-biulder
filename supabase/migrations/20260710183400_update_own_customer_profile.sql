-- RPC para cliente atualizar o próprio perfil
CREATE OR REPLACE FUNCTION public.update_own_customer_profile(
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  UPDATE public.customer_profiles
  SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    company = COALESCE(p_company, company),
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
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
