BEGIN;

-- "Mais vendidos" de verdade: agregado de todos os pedidos.
--
-- A vitrine calculava isso no navegador, somando `orders.items` do que a
-- consulta devolvia. Só que o RLS de `orders` entrega, para o cliente, **apenas
-- os pedidos dele**. Na prática a prateleira mostrava "o que eu mesmo mais
-- peço", e para quem nunca comprou não sobrava sinal nenhum — o desempate caía
-- no tamanho da família do produto, o que parece aleatório para quem olha.
--
-- SECURITY DEFINER para enxergar todos os pedidos, mas devolvendo **só o
-- agregado**: id do produto e quantidade somada. Nenhum dado de cliente sai
-- daqui — é a mesma informação que qualquer loja estampa como "mais vendido".
CREATE OR REPLACE FUNCTION public.top_selling_products(p_limit integer DEFAULT 24)
 RETURNS TABLE(product_id uuid, total_quantity bigint, order_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (item->>'product_id')::uuid AS product_id,
    SUM(GREATEST(COALESCE((item->>'quantity')::numeric, 1), 1))::bigint AS total_quantity,
    COUNT(DISTINCT o.id)::bigint AS order_count
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
  WHERE o.items IS NOT NULL
    -- Pedido cancelado nao e venda. Sem este recorte, um item pedido e
    -- cancelado varias vezes subiria na lista sem nunca ter sido vendido.
    AND COALESCE(o.status, '') <> 'cancelado'
    AND item->>'product_id' IS NOT NULL
    AND item->>'product_id' <> ''
  GROUP BY 1
  ORDER BY total_quantity DESC, order_count DESC
  LIMIT GREATEST(p_limit, 1);
$function$;

GRANT EXECUTE ON FUNCTION public.top_selling_products(integer) TO anon, authenticated;

COMMIT;
