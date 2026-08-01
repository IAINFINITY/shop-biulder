-- Preco "de" para produto em promocao.
--
-- Ate aqui `is_promotion` era so um selo: marcava o produto como promocional sem
-- registrar de quanto era o desconto, entao a vitrine nao tinha como mostrar o
-- valor anterior riscado. Guardar o preco original e o que permite exibir
-- "de R$ 200 por R$ 150" — que e o que comunica a oferta de fato.
--
-- Fica anulavel: produto sem promocao simplesmente nao preenche.

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD COLUMN IF NOT EXISTS compare_at_price numeric;

COMMENT ON COLUMN public."Clinic+ - Catálogo Front B2B".compare_at_price IS
  'Preco anterior, exibido riscado quando maior que price. Nulo = sem comparacao.';

-- Um preco "de" menor ou igual ao atual nao e desconto, e ruido: barrado no banco
-- para nao depender so da validacao da tela.
ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  DROP CONSTRAINT IF EXISTS catalog_products_compare_at_price_check;

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD CONSTRAINT catalog_products_compare_at_price_check
  CHECK (compare_at_price IS NULL OR compare_at_price > price);
