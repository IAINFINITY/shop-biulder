-- Ajusta as chaves de unicidade para suportar tabelas de preco por Proxsys
-- Execute este SQL no editor do Supabase se a migration ainda nao tiver sido aplicada.

ALTER TABLE public.customer_price_overrides
  DROP CONSTRAINT IF EXISTS customer_price_overrides_unique;

CREATE INDEX IF NOT EXISTS customer_price_overrides_proxis_tpr_id_idx
  ON public.customer_price_overrides (proxis_tpr_id);

DROP INDEX IF EXISTS customer_price_overrides_proxis_tpr_product_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS customer_price_overrides_proxis_tpr_product_code_unique
  ON public.customer_price_overrides (proxis_tpr_id, product_code)
  WHERE proxis_tpr_id IS NOT NULL;

DROP INDEX IF EXISTS customer_price_overrides_customer_type_product_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS customer_price_overrides_customer_type_product_code_unique
  ON public.customer_price_overrides (customer_type, product_code)
  WHERE proxis_tpr_id IS NULL;
