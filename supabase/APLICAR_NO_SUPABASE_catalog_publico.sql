-- =============================================================
-- Catálogo público (leitura sem login)
-- Execute no Supabase → SQL Editor
-- =============================================================
-- O site usa a chave "anon" (publishable). Com RLS ativo e sem política
-- para o role "anon", a API devolve 0 linhas mesmo com dados na tabela.
-- =============================================================

ALTER TABLE public."Clinic+ - Catálogo Front B2B" ENABLE ROW LEVEL SECURITY;

-- Garante permissão de SELECT via API (anon + usuários logados)
GRANT SELECT ON TABLE public."Clinic+ - Catálogo Front B2B" TO anon, authenticated;

-- Remove políticas antigas com o mesmo nome (se existirem)
DROP POLICY IF EXISTS "Anyone can view active products" ON public."Clinic+ - Catálogo Front B2B";
DROP POLICY IF EXISTS "Public read active catalog products" ON public."Clinic+ - Catálogo Front B2B";

-- Qualquer visitante do site pode VER produtos ativos (somente leitura)
CREATE POLICY "Public read active catalog products"
  ON public."Clinic+ - Catálogo Front B2B"
  FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

-- Admins: função has_role (criar se ainda não existir — ver security_fix.sql)
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

DROP POLICY IF EXISTS "Admins can view all products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can view all products"
  ON public."Clinic+ - Catálogo Front B2B"
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can insert products"
  ON public."Clinic+ - Catálogo Front B2B"
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can update products"
  ON public."Clinic+ - Catálogo Front B2B"
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete products" ON public."Clinic+ - Catálogo Front B2B";
CREATE POLICY "Admins can delete products"
  ON public."Clinic+ - Catálogo Front B2B"
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Imagens do catálogo (bucket product-images) — leitura pública
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Anyone can view product images"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');
