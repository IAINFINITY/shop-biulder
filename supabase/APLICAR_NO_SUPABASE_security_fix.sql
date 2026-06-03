-- =============================================================
-- CORREÇÃO DE SEGURANÇA - Aplicar no Supabase SQL Editor
-- =============================================================
-- 1. Habilita RLS na tabela orders (protege dados de clientes)
-- 1b. Habilita RLS no catálogo de produtos (somente admin cria/edita/exclui)
-- 1c. Restringe product_types para admins (criar/editar/excluir tipos)
-- 2. Restringe storage para admins (upload/update/delete de imagens)
-- =============================================================

-- ═══════════════════════════════════════════════════════════════
-- PARTE 0: Roles (se ainda não existir)
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- PARTE 0b: RLS no catálogo de produtos (tabela usada pelo app)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public."Clinic+ - Catálogo Front B2B" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public."Clinic+ - Catálogo Front B2B" TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view active products" ON public."Clinic+ - Catálogo Front B2B";
DROP POLICY IF EXISTS "Public read active catalog products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Public read active catalog products"
  ON public."Clinic+ - Catálogo Front B2B" FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "Admins can view all products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can view all products"
  ON public."Clinic+ - Catálogo Front B2B" FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can insert products"
  ON public."Clinic+ - Catálogo Front B2B" FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can update products"
  ON public."Clinic+ - Catálogo Front B2B" FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can delete products"
  ON public."Clinic+ - Catálogo Front B2B" FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════
-- PARTE 0c: Tipos de produto (product_types) - somente admin altera
-- ═══════════════════════════════════════════════════════════════

-- Se você ainda não criou a tabela, use o SQL do README para criá-la.
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view product types" ON public.product_types;
CREATE POLICY "Anyone can view product types"
  ON public.product_types FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert product types" ON public.product_types;
CREATE POLICY "Admins can insert product types"
  ON public.product_types FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update product types" ON public.product_types;
CREATE POLICY "Admins can update product types"
  ON public.product_types FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete product types" ON public.product_types;
CREATE POLICY "Admins can delete product types"
  ON public.product_types FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
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
