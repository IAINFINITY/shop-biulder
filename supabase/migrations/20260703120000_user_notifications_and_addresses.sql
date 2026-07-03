CREATE TABLE IF NOT EXISTS public.catalog_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_notifications
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.catalog_notifications
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS catalog_notifications_target_user_id_idx
  ON public.catalog_notifications (target_user_id);

ALTER TABLE public.catalog_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.catalog_notifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.catalog_notifications TO authenticated;

DROP POLICY IF EXISTS "Public read active catalog notifications" ON public.catalog_notifications;
CREATE POLICY "Public read active catalog notifications"
  ON public.catalog_notifications
  FOR SELECT
  TO anon, authenticated
  USING (
    active IS TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all catalog notifications" ON public.catalog_notifications;
CREATE POLICY "Admins can view all catalog notifications"
  ON public.catalog_notifications
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert catalog notifications" ON public.catalog_notifications;
CREATE POLICY "Admins can insert catalog notifications"
  ON public.catalog_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update catalog notifications" ON public.catalog_notifications;
CREATE POLICY "Admins can update catalog notifications"
  ON public.catalog_notifications
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete catalog notifications" ON public.catalog_notifications;
CREATE POLICY "Admins can delete catalog notifications"
  ON public.catalog_notifications
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_catalog_notifications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_notifications_updated_at ON public.catalog_notifications;
CREATE TRIGGER catalog_notifications_updated_at
  BEFORE UPDATE ON public.catalog_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_catalog_notifications_updated_at();

CREATE TABLE IF NOT EXISTS public.catalog_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES public.catalog_notifications(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_notification_reads_user_notification_idx
  ON public.catalog_notification_reads (user_id, notification_id);

ALTER TABLE public.catalog_notification_reads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_notification_reads TO authenticated;

DROP POLICY IF EXISTS "Users can view own catalog notification reads" ON public.catalog_notification_reads;
CREATE POLICY "Users can view own catalog notification reads"
  ON public.catalog_notification_reads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert own catalog notification reads" ON public.catalog_notification_reads;
CREATE POLICY "Users can insert own catalog notification reads"
  ON public.catalog_notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own catalog notification reads" ON public.catalog_notification_reads;
CREATE POLICY "Users can update own catalog notification reads"
  ON public.catalog_notification_reads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete own catalog notification reads" ON public.catalog_notification_reads;
CREATE POLICY "Users can delete own catalog notification reads"
  ON public.catalog_notification_reads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_catalog_notification_reads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_notification_reads_updated_at ON public.catalog_notification_reads;
CREATE TRIGGER catalog_notification_reads_updated_at
  BEFORE UPDATE ON public.catalog_notification_reads
  FOR EACH ROW EXECUTE FUNCTION public.update_catalog_notification_reads_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Principal',
  cep TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  number TEXT NOT NULL DEFAULT '',
  complement TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  ibge TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_user_default_idx
  ON public.customer_addresses (user_id)
  WHERE is_default IS TRUE;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_addresses TO authenticated;

DROP POLICY IF EXISTS "Customers can view own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can view own addresses"
  ON public.customer_addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Customers can insert own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can insert own addresses"
  ON public.customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Customers can update own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can update own addresses"
  ON public.customer_addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Customers can delete own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can delete own addresses"
  ON public.customer_addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_customer_addresses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_addresses_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_customer_addresses_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.customer_addresses WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'customer_addresses_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_addresses_limit ON public.customer_addresses;
CREATE TRIGGER customer_addresses_limit
  BEFORE INSERT ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_addresses_limit();

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

  UPDATE public.customer_addresses
  SET is_default = (id = p_address_id)
  WHERE user_id = p_user_id;
END;
$$;
