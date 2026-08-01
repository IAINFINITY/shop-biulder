-- Produto em destaque.
--
-- Separado de `is_promotion`: promocao e sobre preco reduzido, destaque e sobre
-- escolha editorial. Um produto pode ser um, o outro, os dois ou nenhum.
--
-- O nome da tabela vem do app (`PRODUCTS_TABLE`), com espacos e acento, entao
-- precisa de aspas em todo lugar.
ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- A vitrine le sempre "os destaques", nunca a coluna sozinha.
CREATE INDEX IF NOT EXISTS produtos_is_featured_idx
  ON public."Clinic+ - Catálogo Front B2B" (is_featured)
  WHERE is_featured;
