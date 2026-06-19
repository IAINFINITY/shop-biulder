-- Tipo de cliente e tabela de precos por cliente
-- Execute este SQL no editor do Supabase se a migration ainda nao tiver sido aplicada.

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS customer_type TEXT;

UPDATE public.customer_profiles
SET customer_type = 'cliente'
WHERE customer_type IS NULL OR btrim(customer_type) = '';

ALTER TABLE public.customer_profiles
  ALTER COLUMN customer_type SET DEFAULT 'cliente',
  ALTER COLUMN customer_type SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.customer_profiles
    ADD CONSTRAINT customer_profiles_customer_type_check
    CHECK (customer_type IN ('cliente', 'lojista', 'distribuidor'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS "Customers can update own profile" ON public.customer_profiles;
CREATE POLICY "Customers can update own profile"
  ON public.customer_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update all customer profiles" ON public.customer_profiles;
CREATE POLICY "Admins can update all customer profiles"
  ON public.customer_profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.customer_price_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_type TEXT NOT NULL,
  product_code TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_price_overrides_unique UNIQUE (customer_type, product_code),
  CONSTRAINT customer_price_overrides_customer_type_check
    CHECK (customer_type IN ('cliente', 'lojista', 'distribuidor')),
  CONSTRAINT customer_price_overrides_price_check CHECK (price >= 0)
);

ALTER TABLE public.customer_price_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view customer price overrides" ON public.customer_price_overrides;
CREATE POLICY "Authenticated can view customer price overrides"
  ON public.customer_price_overrides FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage customer price overrides" ON public.customer_price_overrides;
CREATE POLICY "Admins can manage customer price overrides"
  ON public.customer_price_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_customer_price_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_price_overrides_updated_at ON public.customer_price_overrides;
CREATE TRIGGER customer_price_overrides_updated_at
  BEFORE UPDATE ON public.customer_price_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_price_overrides_updated_at();

CREATE OR REPLACE FUNCTION public.register_customer_profile(
  p_name TEXT,
  p_phone TEXT,
  p_company TEXT,
  p_cnpj TEXT,
  p_customer_type TEXT DEFAULT 'cliente',
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
  v_customer_type TEXT;
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

  INSERT INTO public.customer_profiles (
    user_id, name, phone, company, cnpj, customer_type,
    address_cep, address_street, address_number, address_complement,
    address_neighborhood, address_city, address_state, address_ibge
  )
  VALUES (
    v_user_id, trim(p_name), trim(p_phone), trim(p_company), v_cnpj, v_customer_type,
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
