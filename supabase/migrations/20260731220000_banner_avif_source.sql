-- Versao AVIF do banner, servida antes do WebP.
--
-- Medindo o banner oficial de 1920x600 entregue pelo time de design:
--
--   webp q92   387 KB   erro medio 4,07 por canal
--   avif q70   338 KB   erro medio 2,26
--   avif q60   226 KB   erro medio 3,31
--
-- AVIF ganha nos dois eixos ao mesmo tempo: menor e mais fiel. E o formato que
-- Shopify e os grandes negociam por CDN desde ~2024, sempre com WebP atras para
-- os navegadores que ficaram para tras.
--
-- Fica em coluna separada, e nao por convencao de nome, porque o `<source>` de
-- AVIF nao tem volta: se o arquivo nao existir, o navegador mostra imagem
-- quebrada em vez de cair para o `<img>`. Com a coluna, o `<source>` so e
-- emitido quando o arquivo existe de fato.
--
-- Nulo = banner sem versao AVIF. Continua funcionando pelo WebP.

ALTER TABLE public.catalog_banners
  ADD COLUMN IF NOT EXISTS image_url_avif text;

COMMENT ON COLUMN public.catalog_banners.image_url_avif IS
  'Versao AVIF da arte, servida antes de image_url. Nulo = so WebP.';
