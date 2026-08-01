-- Reorganiza a taxonomia do catalogo em tres eixos independentes.
--
-- Antes: o produto tinha so categoria (formato) e subcategoria, e a subcategoria
-- era presa a uma unica categoria (product_families.type_id NOT NULL). Duas
-- consequencias, ambas reportadas pela operacao:
--
--   1. Chá e Solúvel abriam o campo Subcategoria vazio, porque nenhuma
--      subcategoria tinha sido vinculada a esses dois tipos — mesmo havendo 89
--      produtos com familia preenchida.
--   2. Subcategorias que servem varios formatos (Creatina, Melatonina, Bio...)
--      precisavam ser cadastradas uma vez por categoria, e as copias comecaram a
--      divergir na escrita ("Pré-Treino" x "Pré-treino").
--
-- Depois: subcategoria e global, e a identidade comercial sai do campo
-- subcategoria e passa a viver em Marca.
--
--   Marca        -> Chá Mais, Clinic Mais        (quem assina)
--   Categoria    -> Chá, Cápsula, Solúvel        (como se consome)
--   Subcategoria -> Camomila, Creatina, Whey...  (o que e)

-- ---------------------------------------------------------------------------
-- 1. Unifica grafias divergentes de subcategoria nos produtos
-- ---------------------------------------------------------------------------
-- A grafia vencedora e a mais usada; empate resolve em ordem alfabetica, para o
-- resultado nao depender da ordem de leitura das linhas.

WITH canonical_family AS (
  SELECT
    lower(regexp_replace(trim(family), '\s+', '', 'g')) AS family_key,
    trim(family) AS family_name,
    row_number() OVER (
      PARTITION BY lower(regexp_replace(trim(family), '\s+', '', 'g'))
      ORDER BY count(*) DESC, trim(family) ASC
    ) AS rn
  FROM public."Clinic+ - Catálogo Front B2B"
  WHERE trim(coalesce(family, '')) <> ''
  GROUP BY 1, 2
)
UPDATE public."Clinic+ - Catálogo Front B2B" p
SET family = cf.family_name
FROM canonical_family cf
WHERE cf.rn = 1
  AND lower(regexp_replace(trim(p.family), '\s+', '', 'g')) = cf.family_key
  AND trim(p.family) <> cf.family_name;

-- ---------------------------------------------------------------------------
-- 2. Subcategoria passa a ser global
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_families
  ALTER COLUMN type_id DROP NOT NULL;

ALTER TABLE public.product_families
  DROP CONSTRAINT IF EXISTS product_families_type_id_name_key;

-- Alinha o cadastro com a grafia canonica aplicada acima.
UPDATE public.product_families pf
SET name = sub.family_name
FROM (
  SELECT DISTINCT
    lower(regexp_replace(trim(family), '\s+', '', 'g')) AS family_key,
    trim(family) AS family_name
  FROM public."Clinic+ - Catálogo Front B2B"
  WHERE trim(coalesce(family, '')) <> ''
) sub
WHERE lower(regexp_replace(trim(pf.name), '\s+', '', 'g')) = sub.family_key
  AND trim(pf.name) <> sub.family_name;

-- Com a grafia unificada sobram duplicatas reais (a mesma subcategoria
-- cadastrada uma vez por categoria). Mantem a mais antiga de cada nome.
DELETE FROM public.product_families pf
WHERE pf.id NOT IN (
  SELECT DISTINCT ON (lower(trim(name))) id
  FROM public.product_families
  ORDER BY lower(trim(name)), created_at ASC, id ASC
);

-- type_id fica como coluna morta: nao e mais lida por nenhum caminho do app.
-- Preservada (anulavel) em vez de removida para que esta migration seja
-- reversivel sem perda de informacao.
UPDATE public.product_families SET type_id = NULL WHERE type_id IS NOT NULL;

COMMENT ON COLUMN public.product_families.type_id IS
  'Obsoleto desde 2026-07-31: subcategorias sao globais e servem qualquer categoria.';

ALTER TABLE public.product_families
  DROP CONSTRAINT IF EXISTS product_families_name_key;

ALTER TABLE public.product_families
  ADD CONSTRAINT product_families_name_key UNIQUE (name);

-- ---------------------------------------------------------------------------
-- 3. Recupera as subcategorias que existiam nos produtos mas nao no cadastro
-- ---------------------------------------------------------------------------
-- Origem do sintoma "não abre subcategorias": o backfill anterior dependia de um
-- JOIN com product_types, e Chá e Solúvel ainda nao existiam la naquele momento.

INSERT INTO public.product_families (name)
SELECT DISTINCT trim(p.family)
FROM public."Clinic+ - Catálogo Front B2B" p
WHERE trim(coalesce(p.family, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.product_families pf
    WHERE lower(trim(pf.name)) = lower(trim(p.family))
  )
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Marca
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.product_brands TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_brands TO authenticated;

DROP POLICY IF EXISTS "Public read product brands" ON public.product_brands;
CREATE POLICY "Public read product brands"
ON public.product_brands FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert product brands" ON public.product_brands;
CREATE POLICY "Admins can insert product brands"
ON public.product_brands FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update product brands" ON public.product_brands;
CREATE POLICY "Admins can update product brands"
ON public.product_brands FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete product brands" ON public.product_brands;
CREATE POLICY "Admins can delete product brands"
ON public.product_brands FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_product_brands_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_brands_updated_at ON public.product_brands;
CREATE TRIGGER product_brands_updated_at
BEFORE UPDATE ON public.product_brands
FOR EACH ROW EXECUTE FUNCTION public.update_product_brands_updated_at();

INSERT INTO public.product_brands (name, sort_order) VALUES
  ('Chá Mais', 1),
  ('Clinic Mais', 2)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Marca no produto
-- ---------------------------------------------------------------------------

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD COLUMN IF NOT EXISTS brand text;

-- Todo produto cujo nome comeca com "Chá Mais" pertence a marca Chá Mais —
-- inclui a linha Sublime, que tambem e assinada por ela.
UPDATE public."Clinic+ - Catálogo Front B2B"
SET brand = 'Chá Mais'
WHERE brand IS NULL
  AND trim(name) ILIKE 'Chá Mais%';

-- Cápsula e Solúvel sao integralmente Clinic Mais.
UPDATE public."Clinic+ - Catálogo Front B2B"
SET brand = 'Clinic Mais'
WHERE brand IS NULL
  AND trim(type) IN ('Cápsula', 'Solúvel');

-- Sobram os chás que nao levam "Chá Mais" no nome (Chá misto, Chá Leveza 30).
-- Ficam sem marca de proposito: e uma decisao comercial, nao um palpite de
-- migration. O admin resolve caso a caso.

CREATE INDEX IF NOT EXISTS catalog_products_brand_idx
  ON public."Clinic+ - Catálogo Front B2B" (brand)
  WHERE brand IS NOT NULL;
