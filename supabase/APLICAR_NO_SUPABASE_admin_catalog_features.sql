ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD COLUMN IF NOT EXISTS is_promotion BOOLEAN NOT NULL DEFAULT false;

UPDATE public."Clinic+ - Catálogo Front B2B"
SET is_promotion = false
WHERE is_promotion IS NULL;

CREATE TABLE IF NOT EXISTS public.catalog_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_banners ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.catalog_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.catalog_banners TO authenticated;

DROP POLICY IF EXISTS "Public read active catalog banners" ON public.catalog_banners;
CREATE POLICY "Public read active catalog banners"
  ON public.catalog_banners
  FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "Admins can view all catalog banners" ON public.catalog_banners;
CREATE POLICY "Admins can view all catalog banners"
  ON public.catalog_banners
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert catalog banners" ON public.catalog_banners;
CREATE POLICY "Admins can insert catalog banners"
  ON public.catalog_banners
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update catalog banners" ON public.catalog_banners;
CREATE POLICY "Admins can update catalog banners"
  ON public.catalog_banners
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete catalog banners" ON public.catalog_banners;
CREATE POLICY "Admins can delete catalog banners"
  ON public.catalog_banners
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_catalog_banners_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_banners_updated_at ON public.catalog_banners;
CREATE TRIGGER catalog_banners_updated_at
  BEFORE UPDATE ON public.catalog_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_catalog_banners_updated_at();

