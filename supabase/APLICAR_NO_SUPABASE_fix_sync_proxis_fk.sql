-- Corrige sync_customer_proxis_link: antes do UPDATE, garante que o
-- proxis_tpr_id existe na tabela price_tables para evitar FK violation.
--
-- Se o tpr_id vindo do Proxis nao existir localmente, cria um placeholder.
--
-- Como aplicar: abra o SQL Editor no Supabase Dashboard e cole este arquivo.

DROP FUNCTION IF EXISTS public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.sync_customer_proxis_link(
  p_proxis_pes_id INTEGER DEFAULT NULL,
  p_proxis_tpr_id INTEGER DEFAULT NULL,
  p_proxis_found BOOLEAN DEFAULT false,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_user_id IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem sincronizar para outro usuario';
  END IF;

  IF p_proxis_tpr_id IS NOT NULL THEN
    INSERT INTO public.price_tables (tpr_id, name, active)
    VALUES (p_proxis_tpr_id, 'Tabela Proxis #' || p_proxis_tpr_id, true)
    ON CONFLICT (tpr_id) DO NOTHING;
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

REVOKE ALL ON FUNCTION public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN, UUID) TO authenticated;
