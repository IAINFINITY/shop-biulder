-- Catálogo: leitura pública de produtos ativos (role anon = visitantes do site)
ALTER TABLE public."Clinic+ - Catálogo Front B2B" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public."Clinic+ - Catálogo Front B2B" TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view active products" ON public."Clinic+ - Catálogo Front B2B";
DROP POLICY IF EXISTS "Public read active catalog products" ON public."Clinic+ - Catálogo Front B2B";

CREATE POLICY "Public read active catalog products"
  ON public."Clinic+ - Catálogo Front B2B"
  FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Anyone can view product images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');
