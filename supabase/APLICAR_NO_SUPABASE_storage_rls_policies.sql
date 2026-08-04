-- Aplicar no Supabase (projeto novo fjnjktrsiydrfmrzzhhm)
-- Restaura as policies de RLS do storage product-images que vieram com o banco
-- antigo mas nao foram migradas. Sem elas a publishable key nao lista o bucket
-- (biblioteca de imagens do admin vazia) e upload/remocao por admin falham.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

-- RLS em storage.objects ja esta habilitado no projeto novo
-- (ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; requer ser owner).

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
