ALTER TABLE public.catalog_banners
  ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'catalog';

UPDATE public.catalog_banners
SET placement = 'catalog'
WHERE placement IS NULL OR placement NOT IN ('catalog', 'product');

ALTER TABLE public.catalog_banners
  DROP CONSTRAINT IF EXISTS catalog_banners_placement_check;

ALTER TABLE public.catalog_banners
  ADD CONSTRAINT catalog_banners_placement_check
  CHECK (placement IN ('catalog', 'product'));
