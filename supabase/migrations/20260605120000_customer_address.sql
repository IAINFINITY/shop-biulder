-- Endereço no perfil B2B e nos pedidos
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS address_cep TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_street TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_complement TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_ibge TEXT NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_address_cep TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_street TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_complement TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_neighborhood TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_ibge TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.register_customer_profile(
  p_name TEXT,
  p_phone TEXT,
  p_company TEXT,
  p_cnpj TEXT,
  p_address_cep TEXT DEFAULT '',
  p_address_street TEXT DEFAULT '',
  p_address_number TEXT DEFAULT '',
  p_address_complement TEXT DEFAULT '',
  p_address_neighborhood TEXT DEFAULT '',
  p_address_city TEXT DEFAULT '',
  p_address_state TEXT DEFAULT '',
  p_address_ibge TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cnpj TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_cnpj := regexp_replace(p_cnpj, '\D', '', 'g');
  IF length(v_cnpj) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido';
  END IF;

  INSERT INTO public.customer_profiles (
    user_id, name, phone, company, cnpj,
    address_cep, address_street, address_number, address_complement,
    address_neighborhood, address_city, address_state, address_ibge
  )
  VALUES (
    v_user_id, trim(p_name), trim(p_phone), trim(p_company), v_cnpj,
    regexp_replace(coalesce(p_address_cep, ''), '\D', '', 'g'),
    trim(coalesce(p_address_street, '')),
    trim(coalesce(p_address_number, '')),
    trim(coalesce(p_address_complement, '')),
    trim(coalesce(p_address_neighborhood, '')),
    trim(coalesce(p_address_city, '')),
    upper(trim(coalesce(p_address_state, ''))),
    regexp_replace(coalesce(p_address_ibge, ''), '\D', '', 'g')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    company = EXCLUDED.company,
    cnpj = EXCLUDED.cnpj,
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

REVOKE ALL ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
