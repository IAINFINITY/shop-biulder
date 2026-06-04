-- Execute no SQL Editor do Supabase se a migration ainda não foi aplicada.
-- Perfis B2B para login de clientes (catálogo e pedidos permanecem públicos).

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_profiles_cnpj_unique UNIQUE (cnpj),
  CONSTRAINT customer_profiles_cnpj_digits CHECK (cnpj ~ '^\d{14}$')
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own profile" ON public.customer_profiles;
CREATE POLICY "Customers can view own profile"
  ON public.customer_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all customer profiles" ON public.customer_profiles;
CREATE POLICY "Admins can view all customer profiles"
  ON public.customer_profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.register_customer_profile(
  p_name TEXT,
  p_phone TEXT,
  p_company TEXT,
  p_cnpj TEXT
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

  INSERT INTO public.customer_profiles (user_id, name, phone, company, cnpj)
  VALUES (v_user_id, trim(p_name), trim(p_phone), trim(p_company), v_cnpj)
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    company = EXCLUDED.company,
    cnpj = EXCLUDED.cnpj,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated;
