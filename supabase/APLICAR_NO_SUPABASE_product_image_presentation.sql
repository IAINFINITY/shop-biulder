-- Como a foto do produto deve ser apresentada, e o texto que a descreve.
--
-- image_fit resolve o caso da foto que ja vem com fundo proprio. Ate aqui toda
-- imagem era renderizada com object-contain dentro da moldura 1:1, o que e
-- correto para packshot (produto recortado sobre fundo branco) mas deixa a foto
-- ambientada com faixas vazias nas laterais — o mesmo sintoma de "recortado" que
-- a operacao reportou, agora vindo do lado do CSS em vez do upload.
--
--   contain -> packshot: produto recortado, fundo branco ou transparente
--   cover   -> ambientada: a foto tem cenario proprio e preenche a moldura
--
-- image_alts guarda a descricao de cada imagem, alinhada por indice com
-- image_urls. As fotos de galeria iam para o catalogo com alt vazio, o que
-- desperdicava acessibilidade e SEO.

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD COLUMN IF NOT EXISTS image_fit text,
  ADD COLUMN IF NOT EXISTS image_alts text[];

UPDATE public."Clinic+ - Catálogo Front B2B"
SET image_fit = 'contain'
WHERE image_fit IS NULL;

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ALTER COLUMN image_fit SET DEFAULT 'contain';

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  DROP CONSTRAINT IF EXISTS catalog_products_image_fit_check;

ALTER TABLE public."Clinic+ - Catálogo Front B2B"
  ADD CONSTRAINT catalog_products_image_fit_check
  CHECK (image_fit IN ('contain', 'cover'));
