-- =============================================================
-- CORREÇÃO DE SEGURANÇA - Aplicar no Supabase SQL Editor
-- =============================================================
-- 1. Habilita RLS na tabela orders (protege dados de clientes)
-- 2. Restringe storage para admins (upload/update/delete de imagens)
-- =============================================================

-- ═══════════════════════════════════════════════════════════════
-- PARTE 1: RLS na tabela orders
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════
-- PARTE 2: Storage - apenas admins podem gerenciar imagens
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;

CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND has_role(auth.uid(), 'admin')
  );

-- ═══════════════════════════════════════════════════════════════
-- PARTE 3: Signup - desabilitar no Dashboard
-- ═══════════════════════════════════════════════════════════════
-- Isso NÃO pode ser feito via SQL. Vá em:
--   Supabase Dashboard > Authentication > Providers > Email
--   → Desmarque "Enable email signup"
--   OU
--   → Marque "Confirm email" (exige confirmação antes de liberar sessão)
-- ═══════════════════════════════════════════════════════════════
