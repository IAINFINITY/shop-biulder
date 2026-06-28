-- -------------------------------------------------------------
-- Libera a leitura dos pedidos do próprio cliente logado.
-- Compare apenas os dígitos do CNPJ porque o pedido pode estar formatado.
-- -------------------------------------------------------------

DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;

CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_profiles cp
      WHERE cp.user_id = auth.uid()
        AND regexp_replace(cp.cnpj, '\D', '', 'g') = regexp_replace(customer_cnpj, '\D', '', 'g')
    )
  );
