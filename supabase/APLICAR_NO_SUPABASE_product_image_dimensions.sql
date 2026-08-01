-- Dimensoes da foto de capa, para o admin saber quais produtos estao fora do
-- padrao sem precisar abrir um por um.
--
-- Medindo o catalogo em 31/07/2026: as 143 imagens ativas tinham entre 121 e
-- 900px no menor lado (93 delas abaixo de 300px), e o produto ocupava 69% do
-- quadro em media contra os 85% do padrao de mercado. Nada disso era visivel na
-- interface — so aparecia rodando script.

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer;

COMMENT ON COLUMN public."Clinic+ - Catálogo Front B2B".image_width IS
  'Largura em px da imagem de capa. Preenchida no upload; use scripts/backfill-image-dimensions.mjs para o historico.';
