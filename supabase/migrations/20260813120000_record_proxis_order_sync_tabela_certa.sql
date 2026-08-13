-- `record_proxis_order_sync` nunca existiu no banco — e por isso o painel diz
-- "Pendente no ERP" para pedido que já está lá.
--
-- ## O que estava acontecendo
--
-- Toda tentativa de envio terminava com este erro no log, silenciosamente:
--
--     [proxis-sync] Falha ao registrar status (404): PGRST202
--     Could not find the function public.record_proxis_order_sync(...)
--
-- A migration `20260731120000_orders_proxis_sync.sql` criou a função contra
-- `public.orders`. Essa tabela **não existe** neste banco: a tabela de pedidos é
-- `clinic+b2b_orders`. As colunas de sincronia entraram (por outro caminho, o
-- arquivo solto `APLICAR_NO_SUPABASE_orders_proxis_sync.sql`), mas a função não.
--
-- O resultado é uma coluna decorativa. Medido antes desta correção, nos 23
-- pedidos existentes:
--
--     status       pedidos  tentativas  com data de sincronia  com doc_ped_web
--     legado            13           0                      0                0
--     pendente          10           0                      0                0
--
-- Zero em tudo. O envio funciona — oito dos dez últimos pedidos estão no ERP com
-- `doc_id` — mas nada disso chegava de volta ao banco. O selo da tela lê
-- `proxis_status`, então mostra "pendente" para todo mundo, para sempre.
--
-- É o pior tipo de indicador: ele não está quebrado de um jeito visível, está
-- mentindo com convicção. Foi o que fez alguém reenviar um pedido que já havia
-- sido enviado.
--
-- ## A correção
--
-- A mesma função, apontando para a tabela que existe. O corpo é o da migration
-- original; muda o nome da tabela e o tipo do parâmetro, que aqui precisa
-- aceitar texto — o PostgREST envia a chave como string no JSON.

CREATE OR REPLACE FUNCTION public.record_proxis_order_sync(
  p_submission_key TEXT,
  p_status TEXT,
  p_error TEXT DEFAULT NULL,
  p_doc_ped_web TEXT DEFAULT NULL
)
RETURNS TABLE (order_id UUID, proxis_status TEXT, proxis_attempts INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key UUID;
BEGIN
  -- Chave inválida não pode derrubar o envio: quem chama trata o `false` e o
  -- pedido segue. Sem isto, um texto fora do formato viraria exceção no meio
  -- da rota de pedido.
  BEGIN
    v_key := p_submission_key::UUID;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  RETURN QUERY
  UPDATE public."clinic+b2b_orders" o
  SET
    proxis_status = p_status,
    proxis_error = p_error,
    -- Um doc_ped_web já gravado nunca é sobrescrito: ele é a prova de qual
    -- documento foi reivindicado no ERP para este pedido.
    proxis_doc_ped_web = COALESCE(o.proxis_doc_ped_web, p_doc_ped_web),
    proxis_attempts = COALESCE(o.proxis_attempts, 0) + 1,
    proxis_last_attempt_at = now(),
    proxis_synced_at = CASE WHEN p_status = 'enviado' THEN now() ELSE o.proxis_synced_at END
  WHERE o.submission_key = v_key
  RETURNING o.id, o.proxis_status, o.proxis_attempts;
END;
$$;

-- Somente a rota serverless (service role) registra desfecho de envio.
--
-- anon e authenticated precisam ser revogados por nome: o Supabase concede
-- EXECUTE a esses papéis por default privilege, que é um grant explícito e
-- portanto não sai junto com o REVOKE FROM PUBLIC. Sem isso, sendo a função
-- SECURITY DEFINER, um cliente logado poderia marcar o próprio pedido como
-- enviado ao ERP.
REVOKE ALL ON FUNCTION public.record_proxis_order_sync(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_proxis_order_sync(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- A versão antiga contra `public.orders`, se algum banco a tiver, sai de cena:
-- duas assinaturas para o mesmo nome fariam o PostgREST escolher por tipo, e a
-- escolha errada volta a falhar em silêncio.
DROP FUNCTION IF EXISTS public.record_proxis_order_sync(UUID, TEXT, TEXT, TEXT);
