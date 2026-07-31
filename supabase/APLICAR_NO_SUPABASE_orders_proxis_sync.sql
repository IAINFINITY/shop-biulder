-- Rastreio da sincronia de cada pedido com o Proxis.
--
-- Antes desta migration o resultado do envio ao ERP so existia como um toast no
-- navegador do cliente: pedido entregue e pedido perdido ficavam identicos no
-- painel. Agora o proprio /api/proxis-order grava o desfecho aqui (service role),
-- entao a fila de pendentes fica visivel e o reenvio deixa de ser um chute.
--
-- proxis_status:
--   pendente -> ainda nao confirmado no ERP (falha transitoria, timeout, ERP fora)
--   enviado  -> confirmado pelo SalvarPedidoVenda
--   erro     -> o ERP recusou o pedido; proxis_error guarda o motivo
--   legado   -> pedidos anteriores a esta migration, desfecho desconhecido

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS proxis_status TEXT,
  ADD COLUMN IF NOT EXISTS proxis_error TEXT,
  ADD COLUMN IF NOT EXISTS proxis_doc_ped_web TEXT,
  ADD COLUMN IF NOT EXISTS proxis_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proxis_last_attempt_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS proxis_synced_at TIMESTAMP WITH TIME ZONE;

-- Pedidos ja existentes nunca reportaram desfecho: marcar como legado para nao
-- inundar a fila de pendentes com historico. Reexecutar a migration nao remarca
-- nada, porque so alcanca linhas ainda nulas.
UPDATE public.orders
SET proxis_status = 'legado'
WHERE proxis_status IS NULL;

-- A partir daqui todo pedido novo nasce pendente ate o ERP confirmar.
ALTER TABLE public.orders
  ALTER COLUMN proxis_status SET DEFAULT 'pendente';

ALTER TABLE public.orders
  ALTER COLUMN proxis_status SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_proxis_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_proxis_status_check
  CHECK (proxis_status IN ('pendente', 'enviado', 'erro', 'legado'));

-- Fila de reconciliacao: o painel busca exatamente por estes dois status.
CREATE INDEX IF NOT EXISTS orders_proxis_status_idx
  ON public.orders (proxis_status, created_at DESC)
  WHERE proxis_status IN ('pendente', 'erro');

-- O doc_ped_web e derivado do submission_key, entao repetir o envio reaproveita
-- o mesmo identificador no ERP. O indice garante que dois pedidos distintos
-- nunca reivindiquem o mesmo documento.
CREATE UNIQUE INDEX IF NOT EXISTS orders_proxis_doc_ped_web_key
  ON public.orders (proxis_doc_ped_web)
  WHERE proxis_doc_ped_web IS NOT NULL;

-- Registra o desfecho de uma tentativa de envio. Existe como funcao para que o
-- incremento de proxis_attempts seja atomico: quem chama e a rota serverless,
-- que nao tem como ler e reescrever o contador sem correr risco de corrida.
CREATE OR REPLACE FUNCTION public.record_proxis_order_sync(
  p_submission_key UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL,
  p_doc_ped_web TEXT DEFAULT NULL
)
RETURNS TABLE (order_id UUID, proxis_status TEXT, proxis_attempts INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.orders o
  SET
    proxis_status = p_status,
    proxis_error = p_error,
    -- Um doc_ped_web ja gravado nunca e sobrescrito: ele e a prova de qual
    -- documento foi reivindicado no ERP para este pedido.
    proxis_doc_ped_web = COALESCE(o.proxis_doc_ped_web, p_doc_ped_web),
    proxis_attempts = o.proxis_attempts + 1,
    proxis_last_attempt_at = now(),
    proxis_synced_at = CASE WHEN p_status = 'enviado' THEN now() ELSE o.proxis_synced_at END
  WHERE o.submission_key = p_submission_key
  RETURNING o.id, o.proxis_status, o.proxis_attempts;
END;
$$;

-- Somente a rota serverless (service role) registra desfecho de envio.
--
-- anon e authenticated precisam ser revogados por nome: o Supabase concede
-- EXECUTE a esses papeis por default privilege, que e um grant explicito e
-- portanto nao sai junto com o REVOKE FROM PUBLIC. Sem isso, sendo a funcao
-- SECURITY DEFINER, um cliente logado poderia marcar o proprio pedido como
-- enviado ao ERP.
REVOKE ALL ON FUNCTION public.record_proxis_order_sync(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_proxis_order_sync(UUID, TEXT, TEXT, TEXT) TO service_role;
