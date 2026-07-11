DROP FUNCTION IF EXISTS public.sync_customer_proxis_link(INTEGER, INTEGER, BOOLEAN);

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
