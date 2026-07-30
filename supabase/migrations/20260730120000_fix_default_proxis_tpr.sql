-- Corrige o fallback legado 8278, inexistente no Proxis, para a tabela padrao 8728.
INSERT INTO public.price_tables (tpr_id, name, active)
VALUES (8728, 'Tabela Proxis #8728', true)
ON CONFLICT (tpr_id) DO NOTHING;

UPDATE public.customer_profiles
SET
  proxis_tpr_id = 8728,
  updated_at = now()
WHERE proxis_tpr_id = 8278;
