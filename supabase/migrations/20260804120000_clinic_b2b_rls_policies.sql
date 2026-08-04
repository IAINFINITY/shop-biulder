-- Clinic+ B2B RLS hardening for the shared Supabase project.
-- Internal access is driven by public."clinic+b2b_user_roles".

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."clinic+b2b_user_roles" ur
    WHERE ur.user_id = _user_id
      AND (
        lower(coalesce(ur.role, '')) = lower(coalesce(_role, ''))
        OR (
          lower(coalesce(_role, '')) = 'admin'
          AND lower(coalesce(ur.role, '')) IN (
            'superadmin',
            'admin',
            'consultor',
            'representante',
            'admin_atendimento'
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.clinic_b2b_is_allowed_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."clinic+b2b_user_roles" ur
    WHERE ur.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.clinic_b2b_is_internal_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.clinic_b2b_is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.clinic_b2b_can_view_order(p_customer_cnpj text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.clinic_b2b_is_internal_staff()
    OR EXISTS (
      SELECT 1
      FROM public."clinic+b2b_customer_profiles" cp
      WHERE cp.user_id = auth.uid()
        AND (
          regexp_replace(coalesce(cp.cnpj, ''), '\D', '', 'g') = regexp_replace(coalesce(p_customer_cnpj, ''), '\D', '', 'g')
          OR regexp_replace(coalesce(cp.linked_company_cnpj, ''), '\D', '', 'g') = regexp_replace(coalesce(p_customer_cnpj, ''), '\D', '', 'g')
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.clinic_b2b_is_own_record(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() = p_user_id;
$$;

-- Shared helper grants for policy functions.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_b2b_is_allowed_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_b2b_is_internal_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_b2b_is_superadmin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_b2b_can_view_order(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_b2b_is_own_record(uuid) TO anon, authenticated;

-- Catalog front: public read, internal manage.
ALTER TABLE public."clinic+b2b_clinic_catalogo_front_b2b" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_clinic_catalogo_front_b2b" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_clinic_catalogo_front_b2b" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read active catalog" ON public."clinic+b2b_clinic_catalogo_front_b2b";
CREATE POLICY "Clinic B2B public read active catalog"
  ON public."clinic+b2b_clinic_catalogo_front_b2b"
  FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "Clinic B2B internal read catalog" ON public."clinic+b2b_clinic_catalogo_front_b2b";
CREATE POLICY "Clinic B2B internal read catalog"
  ON public."clinic+b2b_clinic_catalogo_front_b2b"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert catalog" ON public."clinic+b2b_clinic_catalogo_front_b2b";
CREATE POLICY "Clinic B2B internal insert catalog"
  ON public."clinic+b2b_clinic_catalogo_front_b2b"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update catalog" ON public."clinic+b2b_clinic_catalogo_front_b2b";
CREATE POLICY "Clinic B2B internal update catalog"
  ON public."clinic+b2b_clinic_catalogo_front_b2b"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete catalog" ON public."clinic+b2b_clinic_catalogo_front_b2b";
CREATE POLICY "Clinic B2B internal delete catalog"
  ON public."clinic+b2b_clinic_catalogo_front_b2b"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Staff directory.
ALTER TABLE public."clinic+b2b_admin_users" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_admin_users" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B superadmin read admin users" ON public."clinic+b2b_admin_users";
CREATE POLICY "Clinic B2B superadmin read admin users"
  ON public."clinic+b2b_admin_users"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_superadmin());

DROP POLICY IF EXISTS "Clinic B2B superadmin insert admin users" ON public."clinic+b2b_admin_users";
CREATE POLICY "Clinic B2B superadmin insert admin users"
  ON public."clinic+b2b_admin_users"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_superadmin());

DROP POLICY IF EXISTS "Clinic B2B superadmin update admin users" ON public."clinic+b2b_admin_users";
CREATE POLICY "Clinic B2B superadmin update admin users"
  ON public."clinic+b2b_admin_users"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_superadmin())
  WITH CHECK (public.clinic_b2b_is_superadmin());

DROP POLICY IF EXISTS "Clinic B2B superadmin delete admin users" ON public."clinic+b2b_admin_users";
CREATE POLICY "Clinic B2B superadmin delete admin users"
  ON public."clinic+b2b_admin_users"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_superadmin());

-- Banners.
ALTER TABLE public."clinic+b2b_catalog_banners" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_catalog_banners" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_catalog_banners" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read active banners" ON public."clinic+b2b_catalog_banners";
CREATE POLICY "Clinic B2B public read active banners"
  ON public."clinic+b2b_catalog_banners"
  FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "Clinic B2B internal read banners" ON public."clinic+b2b_catalog_banners";
CREATE POLICY "Clinic B2B internal read banners"
  ON public."clinic+b2b_catalog_banners"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert banners" ON public."clinic+b2b_catalog_banners";
CREATE POLICY "Clinic B2B internal insert banners"
  ON public."clinic+b2b_catalog_banners"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update banners" ON public."clinic+b2b_catalog_banners";
CREATE POLICY "Clinic B2B internal update banners"
  ON public."clinic+b2b_catalog_banners"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete banners" ON public."clinic+b2b_catalog_banners";
CREATE POLICY "Clinic B2B internal delete banners"
  ON public."clinic+b2b_catalog_banners"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Notification reads.
ALTER TABLE public."clinic+b2b_catalog_notification_reads" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_catalog_notification_reads" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B read own notification reads" ON public."clinic+b2b_catalog_notification_reads";
CREATE POLICY "Clinic B2B read own notification reads"
  ON public."clinic+b2b_catalog_notification_reads"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B insert own notification reads" ON public."clinic+b2b_catalog_notification_reads";
CREATE POLICY "Clinic B2B insert own notification reads"
  ON public."clinic+b2b_catalog_notification_reads"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B update own notification reads" ON public."clinic+b2b_catalog_notification_reads";
CREATE POLICY "Clinic B2B update own notification reads"
  ON public."clinic+b2b_catalog_notification_reads"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff())
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B delete own notification reads" ON public."clinic+b2b_catalog_notification_reads";
CREATE POLICY "Clinic B2B delete own notification reads"
  ON public."clinic+b2b_catalog_notification_reads"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

-- Notifications.
ALTER TABLE public."clinic+b2b_catalog_notifications" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_catalog_notifications" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_catalog_notifications" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read active notifications" ON public."clinic+b2b_catalog_notifications";
CREATE POLICY "Clinic B2B public read active notifications"
  ON public."clinic+b2b_catalog_notifications"
  FOR SELECT
  TO anon, authenticated
  USING (
    active IS TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clinic B2B internal read notifications" ON public."clinic+b2b_catalog_notifications";
CREATE POLICY "Clinic B2B internal read notifications"
  ON public."clinic+b2b_catalog_notifications"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert notifications" ON public."clinic+b2b_catalog_notifications";
CREATE POLICY "Clinic B2B internal insert notifications"
  ON public."clinic+b2b_catalog_notifications"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update notifications" ON public."clinic+b2b_catalog_notifications";
CREATE POLICY "Clinic B2B internal update notifications"
  ON public."clinic+b2b_catalog_notifications"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete notifications" ON public."clinic+b2b_catalog_notifications";
CREATE POLICY "Clinic B2B internal delete notifications"
  ON public."clinic+b2b_catalog_notifications"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Addresses.
ALTER TABLE public."clinic+b2b_customer_addresses" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_customer_addresses" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B read own addresses" ON public."clinic+b2b_customer_addresses";
CREATE POLICY "Clinic B2B read own addresses"
  ON public."clinic+b2b_customer_addresses"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B insert own addresses" ON public."clinic+b2b_customer_addresses";
CREATE POLICY "Clinic B2B insert own addresses"
  ON public."clinic+b2b_customer_addresses"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B update own addresses" ON public."clinic+b2b_customer_addresses";
CREATE POLICY "Clinic B2B update own addresses"
  ON public."clinic+b2b_customer_addresses"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff())
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B delete own addresses" ON public."clinic+b2b_customer_addresses";
CREATE POLICY "Clinic B2B delete own addresses"
  ON public."clinic+b2b_customer_addresses"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

-- Customer profile.
ALTER TABLE public."clinic+b2b_customer_profiles" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_customer_profiles" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B read own customer profiles" ON public."clinic+b2b_customer_profiles";
CREATE POLICY "Clinic B2B read own customer profiles"
  ON public."clinic+b2b_customer_profiles"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B insert own customer profiles" ON public."clinic+b2b_customer_profiles";
CREATE POLICY "Clinic B2B insert own customer profiles"
  ON public."clinic+b2b_customer_profiles"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B update own customer profiles" ON public."clinic+b2b_customer_profiles";
CREATE POLICY "Clinic B2B update own customer profiles"
  ON public."clinic+b2b_customer_profiles"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff())
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B delete customer profiles" ON public."clinic+b2b_customer_profiles";
CREATE POLICY "Clinic B2B delete customer profiles"
  ON public."clinic+b2b_customer_profiles"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Customer type overrides.
ALTER TABLE public."clinic+b2b_customer_type_overrides" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_customer_type_overrides" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B internal read type overrides" ON public."clinic+b2b_customer_type_overrides";
CREATE POLICY "Clinic B2B internal read type overrides"
  ON public."clinic+b2b_customer_type_overrides"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert type overrides" ON public."clinic+b2b_customer_type_overrides";
CREATE POLICY "Clinic B2B internal insert type overrides"
  ON public."clinic+b2b_customer_type_overrides"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update type overrides" ON public."clinic+b2b_customer_type_overrides";
CREATE POLICY "Clinic B2B internal update type overrides"
  ON public."clinic+b2b_customer_type_overrides"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete type overrides" ON public."clinic+b2b_customer_type_overrides";
CREATE POLICY "Clinic B2B internal delete type overrides"
  ON public."clinic+b2b_customer_type_overrides"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Customer types.
ALTER TABLE public."clinic+b2b_customer_types" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_customer_types" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_customer_types" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read customer types" ON public."clinic+b2b_customer_types";
CREATE POLICY "Clinic B2B public read customer types"
  ON public."clinic+b2b_customer_types"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Clinic B2B internal insert customer types" ON public."clinic+b2b_customer_types";
CREATE POLICY "Clinic B2B internal insert customer types"
  ON public."clinic+b2b_customer_types"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update customer types" ON public."clinic+b2b_customer_types";
CREATE POLICY "Clinic B2B internal update customer types"
  ON public."clinic+b2b_customer_types"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete customer types" ON public."clinic+b2b_customer_types";
CREATE POLICY "Clinic B2B internal delete customer types"
  ON public."clinic+b2b_customer_types"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Price tables.
ALTER TABLE public."clinic+b2b_price_tables" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_price_tables" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B internal read price tables" ON public."clinic+b2b_price_tables";
CREATE POLICY "Clinic B2B internal read price tables"
  ON public."clinic+b2b_price_tables"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert price tables" ON public."clinic+b2b_price_tables";
CREATE POLICY "Clinic B2B internal insert price tables"
  ON public."clinic+b2b_price_tables"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update price tables" ON public."clinic+b2b_price_tables";
CREATE POLICY "Clinic B2B internal update price tables"
  ON public."clinic+b2b_price_tables"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete price tables" ON public."clinic+b2b_price_tables";
CREATE POLICY "Clinic B2B internal delete price tables"
  ON public."clinic+b2b_price_tables"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Customer price overrides.
ALTER TABLE public."clinic+b2b_customer_price_overrides" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_customer_price_overrides" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B customers can read active price overrides" ON public."clinic+b2b_customer_price_overrides";
CREATE POLICY "Clinic B2B customers can read active price overrides"
  ON public."clinic+b2b_customer_price_overrides"
  FOR SELECT
  TO authenticated
  USING (
    active IS TRUE
    AND (
      public.clinic_b2b_is_internal_staff()
      OR EXISTS (
        SELECT 1
        FROM public."clinic+b2b_customer_profiles" cp
        WHERE cp.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Clinic B2B internal read price overrides" ON public."clinic+b2b_customer_price_overrides";
CREATE POLICY "Clinic B2B internal read price overrides"
  ON public."clinic+b2b_customer_price_overrides"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert price overrides" ON public."clinic+b2b_customer_price_overrides";
CREATE POLICY "Clinic B2B internal insert price overrides"
  ON public."clinic+b2b_customer_price_overrides"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update price overrides" ON public."clinic+b2b_customer_price_overrides";
CREATE POLICY "Clinic B2B internal update price overrides"
  ON public."clinic+b2b_customer_price_overrides"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete price overrides" ON public."clinic+b2b_customer_price_overrides";
CREATE POLICY "Clinic B2B internal delete price overrides"
  ON public."clinic+b2b_customer_price_overrides"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- User roles.
ALTER TABLE public."clinic+b2b_user_roles" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_user_roles" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B read own user roles" ON public."clinic+b2b_user_roles";
CREATE POLICY "Clinic B2B read own user roles"
  ON public."clinic+b2b_user_roles"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert user roles" ON public."clinic+b2b_user_roles";
CREATE POLICY "Clinic B2B internal insert user roles"
  ON public."clinic+b2b_user_roles"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update user roles" ON public."clinic+b2b_user_roles";
CREATE POLICY "Clinic B2B internal update user roles"
  ON public."clinic+b2b_user_roles"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete user roles" ON public."clinic+b2b_user_roles";
CREATE POLICY "Clinic B2B internal delete user roles"
  ON public."clinic+b2b_user_roles"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Product taxonomy.
ALTER TABLE public."clinic+b2b_product_brands" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_product_brands" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_product_brands" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read active brands" ON public."clinic+b2b_product_brands";
CREATE POLICY "Clinic B2B public read active brands"
  ON public."clinic+b2b_product_brands"
  FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "Clinic B2B internal read brands" ON public."clinic+b2b_product_brands";
CREATE POLICY "Clinic B2B internal read brands"
  ON public."clinic+b2b_product_brands"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal insert brands" ON public."clinic+b2b_product_brands";
CREATE POLICY "Clinic B2B internal insert brands"
  ON public."clinic+b2b_product_brands"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update brands" ON public."clinic+b2b_product_brands";
CREATE POLICY "Clinic B2B internal update brands"
  ON public."clinic+b2b_product_brands"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete brands" ON public."clinic+b2b_product_brands";
CREATE POLICY "Clinic B2B internal delete brands"
  ON public."clinic+b2b_product_brands"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

ALTER TABLE public."clinic+b2b_product_families" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_product_families" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_product_families" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read families" ON public."clinic+b2b_product_families";
CREATE POLICY "Clinic B2B public read families"
  ON public."clinic+b2b_product_families"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Clinic B2B internal insert families" ON public."clinic+b2b_product_families";
CREATE POLICY "Clinic B2B internal insert families"
  ON public."clinic+b2b_product_families"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update families" ON public."clinic+b2b_product_families";
CREATE POLICY "Clinic B2B internal update families"
  ON public."clinic+b2b_product_families"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete families" ON public."clinic+b2b_product_families";
CREATE POLICY "Clinic B2B internal delete families"
  ON public."clinic+b2b_product_families"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

ALTER TABLE public."clinic+b2b_product_types" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_product_types" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_product_types" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read product types" ON public."clinic+b2b_product_types";
CREATE POLICY "Clinic B2B public read product types"
  ON public."clinic+b2b_product_types"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Clinic B2B internal insert product types" ON public."clinic+b2b_product_types";
CREATE POLICY "Clinic B2B internal insert product types"
  ON public."clinic+b2b_product_types"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal update product types" ON public."clinic+b2b_product_types";
CREATE POLICY "Clinic B2B internal update product types"
  ON public."clinic+b2b_product_types"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete product types" ON public."clinic+b2b_product_types";
CREATE POLICY "Clinic B2B internal delete product types"
  ON public."clinic+b2b_product_types"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Product reviews.
ALTER TABLE public."clinic+b2b_product_reviews" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public."clinic+b2b_product_reviews" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_product_reviews" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B public read reviews" ON public."clinic+b2b_product_reviews";
CREATE POLICY "Clinic B2B public read reviews"
  ON public."clinic+b2b_product_reviews"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Clinic B2B insert own reviews" ON public."clinic+b2b_product_reviews";
CREATE POLICY "Clinic B2B insert own reviews"
  ON public."clinic+b2b_product_reviews"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B update own reviews" ON public."clinic+b2b_product_reviews";
CREATE POLICY "Clinic B2B update own reviews"
  ON public."clinic+b2b_product_reviews"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff())
  WITH CHECK (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B delete own reviews" ON public."clinic+b2b_product_reviews";
CREATE POLICY "Clinic B2B delete own reviews"
  ON public."clinic+b2b_product_reviews"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.clinic_b2b_is_internal_staff());

-- Orders.
ALTER TABLE public."clinic+b2b_orders" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_orders" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B customers can view own orders" ON public."clinic+b2b_orders";
CREATE POLICY "Clinic B2B customers can view own orders"
  ON public."clinic+b2b_orders"
  FOR SELECT
  TO authenticated
  USING (public.clinic_b2b_can_view_order(customer_cnpj));

DROP POLICY IF EXISTS "Clinic B2B customers can insert orders" ON public."clinic+b2b_orders";
CREATE POLICY "Clinic B2B customers can insert orders"
  ON public."clinic+b2b_orders"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.clinic_b2b_is_internal_staff()
    OR EXISTS (
      SELECT 1
      FROM public."clinic+b2b_customer_profiles" cp
      WHERE cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clinic B2B internal update orders" ON public."clinic+b2b_orders";
CREATE POLICY "Clinic B2B internal update orders"
  ON public."clinic+b2b_orders"
  FOR UPDATE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff())
  WITH CHECK (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B internal delete orders" ON public."clinic+b2b_orders";
CREATE POLICY "Clinic B2B internal delete orders"
  ON public."clinic+b2b_orders"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

-- Support conversations and messages.
ALTER TABLE public."clinic+b2b_support_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clinic+b2b_support_messages" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_support_conversations" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."clinic+b2b_support_messages" TO authenticated;

DROP POLICY IF EXISTS "Clinic B2B read own support conversations" ON public."clinic+b2b_support_conversations";
CREATE POLICY "Clinic B2B read own support conversations"
  ON public."clinic+b2b_support_conversations"
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid() OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B insert own support conversations" ON public."clinic+b2b_support_conversations";
CREATE POLICY "Clinic B2B insert own support conversations"
  ON public."clinic+b2b_support_conversations"
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_user_id = auth.uid() OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B update own support conversations" ON public."clinic+b2b_support_conversations";
CREATE POLICY "Clinic B2B update own support conversations"
  ON public."clinic+b2b_support_conversations"
  FOR UPDATE
  TO authenticated
  USING (customer_user_id = auth.uid() OR public.clinic_b2b_is_internal_staff())
  WITH CHECK (customer_user_id = auth.uid() OR public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B delete support conversations" ON public."clinic+b2b_support_conversations";
CREATE POLICY "Clinic B2B delete support conversations"
  ON public."clinic+b2b_support_conversations"
  FOR DELETE
  TO authenticated
  USING (public.clinic_b2b_is_internal_staff());

DROP POLICY IF EXISTS "Clinic B2B read own support messages" ON public."clinic+b2b_support_messages";
CREATE POLICY "Clinic B2B read own support messages"
  ON public."clinic+b2b_support_messages"
  FOR SELECT
  TO authenticated
  USING (
    public.clinic_b2b_is_internal_staff()
    OR EXISTS (
      SELECT 1
      FROM public."clinic+b2b_support_conversations" sc
      WHERE sc.id = conversation_id
        AND sc.customer_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clinic B2B insert own support messages" ON public."clinic+b2b_support_messages";
CREATE POLICY "Clinic B2B insert own support messages"
  ON public."clinic+b2b_support_messages"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND (
      public.clinic_b2b_is_internal_staff()
      OR EXISTS (
        SELECT 1
        FROM public."clinic+b2b_support_conversations" sc
        WHERE sc.id = conversation_id
          AND sc.customer_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Clinic B2B update own support messages" ON public."clinic+b2b_support_messages";
CREATE POLICY "Clinic B2B update own support messages"
  ON public."clinic+b2b_support_messages"
  FOR UPDATE
  TO authenticated
  USING (
    public.clinic_b2b_is_internal_staff()
    OR (
      sender_user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public."clinic+b2b_support_conversations" sc
        WHERE sc.id = conversation_id
          AND sc.customer_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.clinic_b2b_is_internal_staff()
    OR (
      sender_user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public."clinic+b2b_support_conversations" sc
        WHERE sc.id = conversation_id
          AND sc.customer_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Clinic B2B delete own support messages" ON public."clinic+b2b_support_messages";
CREATE POLICY "Clinic B2B delete own support messages"
  ON public."clinic+b2b_support_messages"
  FOR DELETE
  TO authenticated
  USING (
    public.clinic_b2b_is_internal_staff()
    OR (
      sender_user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public."clinic+b2b_support_conversations" sc
        WHERE sc.id = conversation_id
          AND sc.customer_user_id = auth.uid()
      )
    )
  );

-- Product images storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic B2B public read product images" ON storage.objects;
CREATE POLICY "Clinic B2B public read product images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Clinic B2B admin upload product images" ON storage.objects;
CREATE POLICY "Clinic B2B admin upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Clinic B2B admin update product images" ON storage.objects;
CREATE POLICY "Clinic B2B admin update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Clinic B2B admin delete product images" ON storage.objects;
CREATE POLICY "Clinic B2B admin delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
  );
