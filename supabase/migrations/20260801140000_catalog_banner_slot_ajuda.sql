-- Nova area: topo da Central de ajuda.
--
-- A restricao anterior listava as cinco areas que existiam quando a coluna
-- nasceu. Recriar e o unico caminho: CHECK nao aceita acrescimo.
ALTER TABLE public.catalog_banners
  DROP CONSTRAINT IF EXISTS catalog_banners_slot_check;

ALTER TABLE public.catalog_banners
  ADD CONSTRAINT catalog_banners_slot_check
  CHECK (slot IN ('topo', 'trio', 'par', 'destaque', 'faixa', 'ajuda'));
