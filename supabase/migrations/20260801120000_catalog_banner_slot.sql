-- Area do site a que cada banner pertence.
--
-- Ate aqui a tabela guardava uma lista plana, e so o banner do topo chegava a
-- vitrine. As demais areas (trio, par, destaque, faixa) mostravam exemplo fixo,
-- porque nao havia como dizer "esta arte e do trio".
--
-- 'topo' como padrao: e o que toda linha existente e hoje.
ALTER TABLE public.catalog_banners
  ADD COLUMN IF NOT EXISTS slot TEXT NOT NULL DEFAULT 'topo';

UPDATE public.catalog_banners
SET slot = 'topo'
WHERE slot IS NULL OR slot NOT IN ('topo', 'trio', 'par', 'destaque', 'faixa');

ALTER TABLE public.catalog_banners
  DROP CONSTRAINT IF EXISTS catalog_banners_slot_check;

ALTER TABLE public.catalog_banners
  ADD CONSTRAINT catalog_banners_slot_check
  CHECK (slot IN ('topo', 'trio', 'par', 'destaque', 'faixa'));

-- A vitrine sempre le por area, e dentro dela por ordem.
CREATE INDEX IF NOT EXISTS catalog_banners_slot_sort_idx
  ON public.catalog_banners (slot, sort_order);
