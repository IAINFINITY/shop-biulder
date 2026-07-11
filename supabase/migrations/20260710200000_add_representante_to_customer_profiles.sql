-- Add representante_id to customer_profiles
ALTER TABLE public.customer_profiles
ADD COLUMN IF NOT EXISTS representante_id UUID REFERENCES public.admin_users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_representante_id
ON public.customer_profiles (representante_id);

-- Update ensure_support_conversation to auto-assign based on representante
CREATE OR REPLACE FUNCTION public.ensure_support_conversation(p_subject TEXT DEFAULT 'Atendimento')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_conversation_id UUID;
  v_subject TEXT := COALESCE(NULLIF(trim(p_subject), ''), 'Atendimento');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT
    cp.name,
    cp.company,
    cp.phone,
    cp.cnpj,
    cp.representante_id
  INTO v_profile
  FROM public.customer_profiles cp
  WHERE cp.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cliente não encontrado';
  END IF;

  INSERT INTO public.support_conversations (
    customer_user_id,
    customer_name,
    customer_company,
    customer_phone,
    customer_cnpj,
    subject,
    assigned_admin_id
  )
  VALUES (
    v_user_id,
    trim(v_profile.name),
    NULLIF(trim(v_profile.company), ''),
    NULLIF(trim(v_profile.phone), ''),
    NULLIF(trim(v_profile.cnpj), ''),
    v_subject,
    v_profile.representante_id
  )
  ON CONFLICT (customer_user_id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_company = EXCLUDED.customer_company,
    customer_phone = EXCLUDED.customer_phone,
    customer_cnpj = EXCLUDED.customer_cnpj,
    subject = EXCLUDED.subject,
    assigned_admin_id = CASE
      WHEN EXCLUDED.assigned_admin_id IS NOT NULL THEN EXCLUDED.assigned_admin_id
      ELSE support_conversations.assigned_admin_id
    END,
    updated_at = now()
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

-- RPC to update customer's representative (admin only)
CREATE OR REPLACE FUNCTION public.set_customer_representante(
  p_customer_user_id UUID,
  p_representante_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o representante do cliente';
  END IF;

  UPDATE public.customer_profiles
  SET
    representante_id = p_representante_id,
    updated_at = now()
  WHERE user_id = p_customer_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_representante(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_customer_representante(UUID, UUID) TO authenticated;
