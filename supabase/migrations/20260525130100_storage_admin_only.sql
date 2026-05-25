-- Restrict product-images storage to admin-only (upload, update, delete)
-- Public read remains open (anyone can view images)

-- Remove overly permissive policies that allow any authenticated user
DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;

-- Only admins can upload images
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND has_role(auth.uid(), 'admin')
  );

-- Only admins can update images
CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND has_role(auth.uid(), 'admin')
  );

-- Only admins can delete images
CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND has_role(auth.uid(), 'admin')
  );
