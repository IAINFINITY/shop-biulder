-- Vinculo do cliente com o Proxsys apos o cadastro no front
-- Guarda o participante encontrado e a tabela de preco atual do ERP.

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS proxis_pes_id INTEGER,
  ADD COLUMN IF NOT EXISTS proxis_tpr_id INTEGER,
  ADD COLUMN IF NOT EXISTS proxis_found BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxis_synced_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.sync_customer_proxis_link(
  p_proxis_pes_id INTEGER DEFAULT NULL,
  p_proxis_tpr_id INTEGER DEFAULT NULL,
  p_proxis_found BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  UPDATE public.customer_profiles
  SET
    proxis_pes_id = p_proxis_pes_id,
    proxis_tpr_id = p_proxis_tpr_id,
    proxis_found = COALESCE(p_proxis_found, false),
    proxis_synced_at = now(),
    updated_at = now()
  WHERE user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN) TO authenticated;
