-- Arte de celular do banner.
--
-- O jogo entregue pelo time de design tem duas pecas: 1920x600 (16:5) para
-- desktop e 800x320 (5:2) para celular. Nao sao a mesma imagem redimensionada —
-- sao enquadramentos diferentes, com o texto reposicionado para caber.
--
-- Com uma arte so, o celular recebia a de desktop cortada no centro, o que come
-- justamente as laterais onde o titulo costuma terminar.
--
-- Nulo = banner sem peca de celular. Continua usando a de desktop, cortada.

ALTER TABLE public.catalog_banners
  ADD COLUMN IF NOT EXISTS image_url_mobile text;

ALTER TABLE public.catalog_banners
  ADD COLUMN IF NOT EXISTS image_url_mobile_avif text;

COMMENT ON COLUMN public.catalog_banners.image_url_mobile IS
  'Arte 800x320 para telas pequenas. Nulo = usa a de desktop.';
COMMENT ON COLUMN public.catalog_banners.image_url_mobile_avif IS
  'Versao AVIF da arte de celular, servida antes do WebP.';
