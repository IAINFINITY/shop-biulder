-- Clinic+ B2B: restore column defaults, PKs/constraints and the 8 missing
-- RPCs the frontend calls, adapted to the clinic+b2b_* table names.
-- Defaults extracted from the old database (OpenAPI) and the original migrations.

BEGIN;

-- =============================================================
-- 1. COLUMN DEFAULTS
-- =============================================================

ALTER TABLE public."clinic+b2b_orders"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN items SET DEFAULT '[]'::jsonb,
  ALTER COLUMN total_items SET DEFAULT 0,
  ALTER COLUMN status SET DEFAULT 'NOVO CARRINHO',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN customer_address_cep SET DEFAULT '',
  ALTER COLUMN customer_address_street SET DEFAULT '',
  ALTER COLUMN customer_address_number SET DEFAULT '',
  ALTER COLUMN customer_address_complement SET DEFAULT '',
  ALTER COLUMN customer_address_neighborhood SET DEFAULT '',
  ALTER COLUMN customer_address_city SET DEFAULT '',
  ALTER COLUMN customer_address_state SET DEFAULT '',
  ALTER COLUMN customer_address_ibge SET DEFAULT '',
  ALTER COLUMN submission_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN proxis_status SET DEFAULT 'pendente',
  ALTER COLUMN proxis_attempts SET DEFAULT 0;

ALTER TABLE public."clinic+b2b_customer_profiles"
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN address_cep SET DEFAULT '',
  ALTER COLUMN address_street SET DEFAULT '',
  ALTER COLUMN address_number SET DEFAULT '',
  ALTER COLUMN address_complement SET DEFAULT '',
  ALTER COLUMN address_neighborhood SET DEFAULT '',
  ALTER COLUMN address_city SET DEFAULT '',
  ALTER COLUMN address_state SET DEFAULT '',
  ALTER COLUMN address_ibge SET DEFAULT '',
  ALTER COLUMN customer_type SET DEFAULT 'cliente',
  ALTER COLUMN proxis_found SET DEFAULT false;

ALTER TABLE public."clinic+b2b_customer_price_overrides"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN price SET DEFAULT 0,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_customer_type_overrides"
  ALTER COLUMN customer_type SET DEFAULT 'cliente',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_customer_addresses"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN label SET DEFAULT 'Principal',
  ALTER COLUMN cep SET DEFAULT '',
  ALTER COLUMN street SET DEFAULT '',
  ALTER COLUMN number SET DEFAULT '',
  ALTER COLUMN complement SET DEFAULT '',
  ALTER COLUMN neighborhood SET DEFAULT '',
  ALTER COLUMN city SET DEFAULT '',
  ALTER COLUMN state SET DEFAULT '',
  ALTER COLUMN ibge SET DEFAULT '',
  ALTER COLUMN is_default SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_customer_types"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_catalog_banners"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN slot SET DEFAULT 'topo';

ALTER TABLE public."clinic+b2b_catalog_notifications"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN priority SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_catalog_notification_reads"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN read_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_product_families"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_product_brands"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_product_types"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_product_reviews"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN tags SET DEFAULT '{}'::text[];

ALTER TABLE public."clinic+b2b_support_conversations"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN subject SET DEFAULT 'Atendimento',
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN last_message_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_support_messages"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_admin_users"
  ALTER COLUMN display_name SET DEFAULT '',
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_user_roles"
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public."clinic+b2b_price_tables"
  ALTER COLUMN name SET DEFAULT '',
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public."clinic+b2b_clinic_catalogo_front_b2b"
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN price SET DEFAULT 0,
  ALTER COLUMN image_urls SET DEFAULT '{}'::text[],
  ALTER COLUMN is_promotion SET DEFAULT false,
  ALTER COLUMN average_rating SET DEFAULT 0,
  ALTER COLUMN review_count SET DEFAULT 0,
  ALTER COLUMN image_fit SET DEFAULT 'contain',
  ALTER COLUMN is_featured SET DEFAULT false;

-- =============================================================
-- 2. PRIMARY KEYS (needed for ON CONFLICT in RPCs and REST API)
-- =============================================================

ALTER TABLE public."clinic+b2b_orders" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_customer_profiles" ADD PRIMARY KEY (user_id);
ALTER TABLE public."clinic+b2b_customer_price_overrides" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_customer_type_overrides" ADD PRIMARY KEY (cnpj);
ALTER TABLE public."clinic+b2b_customer_addresses" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_customer_types" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_catalog_banners" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_catalog_notifications" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_catalog_notification_reads" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_product_families" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_product_brands" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_product_types" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_product_reviews" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_support_conversations" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_support_messages" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_admin_users" ADD PRIMARY KEY (user_id);
ALTER TABLE public."clinic+b2b_user_roles" ADD PRIMARY KEY (id);
ALTER TABLE public."clinic+b2b_price_tables" ADD PRIMARY KEY (tpr_id);
ALTER TABLE public."clinic+b2b_clinic_catalogo_front_b2b" ADD PRIMARY KEY (id);

ALTER TABLE public."clinic+b2b_user_roles" ADD CONSTRAINT clinic_b2b_user_roles_user_role_unique UNIQUE (user_id, role);

-- Partial unique: only one default address per user
CREATE UNIQUE INDEX IF NOT EXISTS clinic_b2b_customer_addresses_user_default_idx
  ON public."clinic+b2b_customer_addresses" (user_id)
  WHERE is_default IS TRUE;

CREATE INDEX IF NOT EXISTS clinic_b2b_orders_created_at_idx
  ON public."clinic+b2b_orders" (created_at DESC);

-- =============================================================
-- 3. updated_at TRIGGERS
-- =============================================================

CREATE OR REPLACE FUNCTION public.clinic_b2b_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables_with_updated_at text[] := ARRAY[
    'clinic+b2b_customer_profiles',
    'clinic+b2b_customer_price_overrides',
    'clinic+b2b_customer_type_overrides',
    'clinic+b2b_customer_addresses',
    'clinic+b2b_catalog_banners',
    'clinic+b2b_catalog_notifications',
    'clinic+b2b_catalog_notification_reads',
    'clinic+b2b_product_families',
    'clinic+b2b_product_brands',
    'clinic+b2b_product_reviews',
    'clinic+b2b_support_conversations',
    'clinic+b2b_support_messages',
    'clinic+b2b_admin_users',
    'clinic+b2b_price_tables',
    'clinic+b2b_clinic_catalogo_front_b2b'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_updated_at LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I;',
      t || '_updated_at', t
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.clinic_b2b_set_updated_at();',
      t || '_updated_at', t
    );
  END LOOP;
END;
$$;

-- =============================================================
-- 4. MISSING RPCs
-- =============================================================

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
    FROM public."clinic+b2b_customer_type_overrides"
   WHERE cnpj = v_cnpj
   LIMIT 1;

  IF v_override_type IS NOT NULL THEN
    v_customer_type := lower(trim(v_override_type));
  END IF;

  INSERT INTO public."clinic+b2b_customer_profiles" (
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

  INSERT INTO public."clinic+b2b_user_roles" (user_id, role)
  VALUES (v_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_customer_default_address(p_user_id uuid, p_address_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  UPDATE public."clinic+b2b_customer_addresses"
  SET is_default = (id = p_address_id)
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_default_address(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_customer_default_address(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_customer_representante(
  p_customer_user_id UUID,
  p_representante_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o representante do cliente';
  END IF;

  UPDATE public."clinic+b2b_customer_profiles"
  SET
    representante_id = p_representante_id,
    updated_at = now()
  WHERE user_id = p_customer_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_representante(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_customer_representante(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_admin_display_name(p_user_id UUID, p_display_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public."clinic+b2b_admin_users" (user_id, display_name)
  VALUES (p_user_id, p_display_name)
  ON CONFLICT (user_id)
  DO UPDATE SET display_name = p_display_name, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_admin_display_name(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_admin_display_name(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_email(
  p_user_id UUID,
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users SET email = p_email WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_email(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.top_selling_products(p_limit integer DEFAULT 24)
 RETURNS TABLE(product_id uuid, total_quantity bigint, order_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (item->>'product_id')::uuid AS product_id,
    SUM(GREATEST(COALESCE((item->>'quantity')::numeric, 1), 1))::bigint AS total_quantity,
    COUNT(DISTINCT o.id)::bigint AS order_count
  FROM public."clinic+b2b_orders" o
  CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
  WHERE o.items IS NOT NULL
    AND COALESCE(o.status, '') <> 'cancelado'
    AND item->>'product_id' IS NOT NULL
    AND item->>'product_id' <> ''
  GROUP BY 1
  ORDER BY total_quantity DESC, order_count DESC
  LIMIT GREATEST(p_limit, 1);
$function$;

GRANT EXECUTE ON FUNCTION public.top_selling_products(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating numeric;
  cnt integer;
BEGIN
  SELECT
    coalesce(avg(rating)::numeric(3,2), 0),
    count(*)
  INTO avg_rating, cnt
  FROM public."clinic+b2b_product_reviews"
  WHERE product_id = coalesce(NEW.product_id, OLD.product_id);

  UPDATE public."clinic+b2b_clinic_catalogo_front_b2b"
  SET
    average_rating = avg_rating,
    review_count = cnt
  WHERE id = coalesce(NEW.product_id, OLD.product_id);

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_clinic_b2b_product_reviews_update_rating ON public."clinic+b2b_product_reviews";
CREATE TRIGGER trg_clinic_b2b_product_reviews_update_rating
  AFTER INSERT OR DELETE OR UPDATE OF rating
  ON public."clinic+b2b_product_reviews"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_rating();

CREATE OR REPLACE FUNCTION public.get_product_reviews(
  p_product_id uuid,
  p_page integer default 1,
  p_page_size integer default 5
)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  user_id uuid,
  rating smallint,
  title text,
  comment text,
  tags text[],
  admin_response text,
  admin_responded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  user_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_offset integer;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  RETURN QUERY
  SELECT
    r.id,
    r.product_id,
    r.user_id,
    r.rating,
    r.title,
    r.comment,
    r.tags,
    r.admin_response,
    r.admin_responded_at,
    r.created_at,
    r.updated_at,
    coalesce(p.name, 'Usuario') AS user_name
  FROM public."clinic+b2b_product_reviews" r
  LEFT JOIN public."clinic+b2b_customer_profiles" p ON p.user_id = r.user_id
  WHERE r.product_id = p_product_id
  ORDER BY r.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_reviews(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_reviews(uuid, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_product_reviews(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT count(*) FROM public."clinic+b2b_product_reviews" WHERE product_id = p_product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.count_product_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_product_reviews(uuid) TO authenticated;

COMMIT;
