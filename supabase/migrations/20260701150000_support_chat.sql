-- Base do chat interno entre cliente e time comercial/administrativo.

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_company TEXT,
  customer_phone TEXT,
  customer_cnpj TEXT,
  assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT 'Atendimento',
  status TEXT NOT NULL DEFAULT 'open',
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_conversations_customer_unique UNIQUE (customer_user_id),
  CONSTRAINT support_conversations_status_check CHECK (status IN ('open', 'closed', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_sender_role_check CHECK (sender_role IN ('customer', 'admin'))
);

CREATE INDEX IF NOT EXISTS support_conversations_last_message_at_idx
  ON public.support_conversations (last_message_at DESC);

CREATE INDEX IF NOT EXISTS support_conversations_status_idx
  ON public.support_conversations (status);

CREATE INDEX IF NOT EXISTS support_messages_conversation_created_at_idx
  ON public.support_messages (conversation_id, created_at);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers and admins can view support conversations" ON public.support_conversations;
CREATE POLICY "Customers and admins can view support conversations"
  ON public.support_conversations
  FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Customers and admins can create support conversations" ON public.support_conversations;
CREATE POLICY "Customers and admins can create support conversations"
  ON public.support_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Customers and admins can update support conversations" ON public.support_conversations;
CREATE POLICY "Customers and admins can update support conversations"
  ON public.support_conversations
  FOR UPDATE
  TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    customer_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete support conversations" ON public.support_conversations;
CREATE POLICY "Admins can delete support conversations"
  ON public.support_conversations
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Customers and admins can view support messages" ON public.support_messages;
CREATE POLICY "Customers and admins can view support messages"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_conversations conversation
      WHERE conversation.id = support_messages.conversation_id
        AND (
          conversation.customer_user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Customers and admins can create support messages" ON public.support_messages;
CREATE POLICY "Customers and admins can create support messages"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.support_conversations conversation
      WHERE conversation.id = support_messages.conversation_id
        AND (
          conversation.customer_user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Customers and admins can update support messages" ON public.support_messages;
CREATE POLICY "Customers and admins can update support messages"
  ON public.support_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_conversations conversation
      WHERE conversation.id = support_messages.conversation_id
        AND (
          conversation.customer_user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  )
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.support_conversations conversation
      WHERE conversation.id = support_messages.conversation_id
        AND (
          conversation.customer_user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Admins can delete support messages" ON public.support_messages;
CREATE POLICY "Admins can delete support messages"
  ON public.support_messages
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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
    cp.cnpj
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
    subject
  )
  VALUES (
    v_user_id,
    trim(v_profile.name),
    NULLIF(trim(v_profile.company), ''),
    NULLIF(trim(v_profile.phone), ''),
    NULLIF(trim(v_profile.cnpj), ''),
    v_subject
  )
  ON CONFLICT (customer_user_id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_company = EXCLUDED.customer_company,
    customer_phone = EXCLUDED.customer_phone,
    customer_cnpj = EXCLUDED.customer_cnpj,
    subject = EXCLUDED.subject,
    updated_at = now()
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_support_conversation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_support_conversation(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_support_conversation_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = left(regexp_replace(trim(NEW.body), '\s+', ' ', 'g'), 140),
    assigned_admin_id = CASE
      WHEN NEW.sender_role = 'admin' AND assigned_admin_id IS NULL THEN NEW.sender_user_id
      ELSE assigned_admin_id
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_touch_conversation ON public.support_messages;
CREATE TRIGGER support_messages_touch_conversation
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_support_conversation_from_message();

CREATE OR REPLACE FUNCTION public.update_support_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_conversations_updated_at ON public.support_conversations;
CREATE TRIGGER support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_conversations_updated_at();

DROP TRIGGER IF EXISTS support_messages_updated_at ON public.support_messages;
CREATE TRIGGER support_messages_updated_at
  BEFORE UPDATE ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_conversations_updated_at();
