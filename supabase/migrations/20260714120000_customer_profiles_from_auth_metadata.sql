-- Create customer profiles automatically from Supabase Auth metadata.
-- This keeps the admin client base in sync even when email confirmation prevents an immediate session.

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

  IF v_name = '' OR v_phone = '' OR v_company = '' OR length(v_cnpj) NOT IN (11, 14) THEN
    RETURN NEW;
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

  INSERT INTO public.customer_profiles (
    user_id,
    name,
    phone,
    company,
    cnpj,
    customer_type,
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

INSERT INTO public.customer_profiles (
  user_id,
  name,
  phone,
  company,
  cnpj,
  customer_type,
  address_cep,
  address_street,
  address_number,
  address_complement,
  address_neighborhood,
  address_city,
  address_state,
  address_ibge
)
SELECT
  u.id,
  trim(coalesce(u.raw_user_meta_data->>'name', '')),
  trim(coalesce(u.raw_user_meta_data->>'phone', '')),
  trim(coalesce(u.raw_user_meta_data->>'company', '')),
  regexp_replace(coalesce(u.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g'),
  CASE
    WHEN lower(trim(coalesce(u.raw_user_meta_data->>'customer_type', 'cliente'))) IN ('cliente', 'lojista', 'distribuidor')
      THEN lower(trim(coalesce(u.raw_user_meta_data->>'customer_type', 'cliente')))
    ELSE 'cliente'
  END,
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1
    FROM public.customer_profiles cp
    WHERE cp.user_id = u.id
  )
  AND lower(trim(coalesce(u.raw_app_meta_data->>'role', ''))) NOT IN (
    'admin',
    'superadmin',
    'consultor',
    'representante',
    'admin_atendimento'
  )
  AND trim(coalesce(u.raw_user_meta_data->>'name', '')) <> ''
  AND trim(coalesce(u.raw_user_meta_data->>'phone', '')) <> ''
  AND trim(coalesce(u.raw_user_meta_data->>'company', '')) <> ''
  AND length(regexp_replace(coalesce(u.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g')) IN (11, 14)
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  company = EXCLUDED.company,
  cnpj = EXCLUDED.cnpj,
  customer_type = EXCLUDED.customer_type,
  updated_at = now();

INSERT INTO public.user_roles (user_id, role)
SELECT
  u.id,
  'user'
FROM auth.users u
WHERE EXISTS (
    SELECT 1
    FROM public.customer_profiles cp
    WHERE cp.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;
