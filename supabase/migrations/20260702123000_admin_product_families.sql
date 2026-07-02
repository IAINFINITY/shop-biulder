CREATE TABLE IF NOT EXISTS public.product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.product_families (name)
SELECT DISTINCT trim(family)
FROM public."Clinic+ - Catálogo Front B2B"
WHERE trim(coalesce(family, '')) <> ''
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.product_families TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_families TO authenticated;

DROP POLICY IF EXISTS "Public read product families" ON public.product_families;
CREATE POLICY "Public read product families"
ON public.product_families
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can view product families" ON public.product_families;
CREATE POLICY "Admins can view product families"
ON public.product_families
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert product families" ON public.product_families;
CREATE POLICY "Admins can insert product families"
ON public.product_families
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update product families" ON public.product_families;
CREATE POLICY "Admins can update product families"
ON public.product_families
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete product families" ON public.product_families;
CREATE POLICY "Admins can delete product families"
ON public.product_families
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_product_families_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_families_updated_at ON public.product_families;
CREATE TRIGGER product_families_updated_at
BEFORE UPDATE ON public.product_families
FOR EACH ROW EXECUTE FUNCTION public.update_product_families_updated_at();
