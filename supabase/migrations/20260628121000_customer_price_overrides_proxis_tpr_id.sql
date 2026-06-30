-- Vinculo opcional da tabela de precos com o tpr_id do Proxsys

ALTER TABLE public.customer_price_overrides
  ADD COLUMN IF NOT EXISTS proxis_tpr_id INTEGER;

CREATE INDEX IF NOT EXISTS customer_price_overrides_proxis_tpr_id_idx
  ON public.customer_price_overrides (proxis_tpr_id);
