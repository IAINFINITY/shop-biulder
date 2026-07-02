CREATE TABLE IF NOT EXISTS public.customer_type_overrides (
  cnpj TEXT PRIMARY KEY,
  customer_type TEXT NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_type_overrides_cnpj_digits CHECK (cnpj ~ '^\d{14}$'),
  CONSTRAINT customer_type_overrides_customer_type_check CHECK (customer_type IN ('cliente', 'lojista', 'distribuidor'))
);

ALTER TABLE public.customer_type_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view customer type overrides" ON public.customer_type_overrides;
CREATE POLICY "Admins can view customer type overrides"
  ON public.customer_type_overrides FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage customer type overrides" ON public.customer_type_overrides;
CREATE POLICY "Admins can manage customer type overrides"
  ON public.customer_type_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_customer_type_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_type_overrides_updated_at ON public.customer_type_overrides;
CREATE TRIGGER customer_type_overrides_updated_at
  BEFORE UPDATE ON public.customer_type_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_type_overrides_updated_at();

DROP FUNCTION IF EXISTS public.register_customer_profile(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);

CREATE OR REPLACE FUNCTION public.register_customer_profile(
  p_name TEXT,
  p_phone TEXT,
  p_company TEXT,
  p_cnpj TEXT,
  p_customer_type TEXT,
  p_address_cep TEXT,
  p_address_street TEXT,
  p_address_number TEXT,
  p_address_complement TEXT,
  p_address_neighborhood TEXT,
  p_address_city TEXT,
  p_address_state TEXT,
  p_address_ibge TEXT
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
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_cnpj := regexp_replace(p_cnpj, '\D', '', 'g');
  IF length(v_cnpj) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido';
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
    trim(p_address_cep), trim(p_address_street), trim(p_address_number), trim(p_address_complement),
    trim(p_address_neighborhood), trim(p_address_city), trim(p_address_state), trim(p_address_ibge)
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
