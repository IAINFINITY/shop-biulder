-- Um funcionário via os pedidos de todos os outros funcionários.
--
-- ## O que acontecia
--
-- Relatado em 02/09/2026, com print: uma funcionária abriu "Meus pedidos" e
-- viu dois — o dela e o de outra pessoa. O palpite de quem relatou estava
-- certo: "é pq está vinculado no mesmo cnpj?"
--
-- Sim. `clinic_b2b_can_view_order` libera o pedido quando o CNPJ dele bate com
-- o `cnpj` **ou** com o `linked_company_cnpj` do perfil. Para um cliente B2B
-- isso é a regra desejada: várias pessoas da mesma empresa acompanham os
-- pedidos da empresa.
--
-- Para funcionário, a mesma regra vira vazamento. Os **97** perfis de
-- funcionário têm `linked_company_cnpj = 04163851000106` — o CNPJ da própria
-- Clinic+ — e a compra do funcionário é gravada com esse CNPJ, porque é a
-- empresa quem fatura. Resultado: 97 pessoas com acesso à compra pessoal umas
-- das outras, e ao histórico dela.
--
-- A diferença é que, para o cliente, a empresa **é** o comprador. Para o
-- funcionário, a empresa é só quem fatura: a compra é dele.
--
-- ## Por que o pedido passa a guardar `user_id`
--
-- Sem ele não há como distinguir "meu pedido" de "pedido de um colega", porque
-- os dois carregam o mesmo CNPJ. A ausência da coluna era deliberada e está
-- registrada: o pedido pode nascer sem conta e ser reivindicado depois pelo
-- CNPJ. Isso continua valendo — a coluna é **opcional**, e a regra do CNPJ
-- segue existindo para os clientes B2B.
--
-- O que muda é que, quando há dono registrado, ele é a resposta.

alter table public."clinic+b2b_orders"
  add column if not exists user_id uuid references auth.users(id) on delete set null;

comment on column public."clinic+b2b_orders".user_id is
  'Quem estava logado ao fechar o pedido. Nulo em pedido antigo — nesse caso a visibilidade cai na regra do CNPJ.';

create index if not exists idx_pedido_por_dono
  on public."clinic+b2b_orders" (user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Backfill dos pedidos que já existem
-- ---------------------------------------------------------------------------
--
-- ⚠️ Só quando o telefone identifica **uma** pessoa. Nome também bateria nos
-- dois pedidos de funcionário que existem hoje, mas nome se repete, e um
-- palpite errado aqui daria o pedido de alguém para outra pessoa — exatamente
-- o que esta migration existe para impedir. Sem certeza, o pedido fica sem dono
-- e cai na regra do CNPJ, como sempre foi.

update public."clinic+b2b_orders" o
   set user_id = p.user_id
  from public."clinic+b2b_customer_profiles" p
 where o.user_id is null
   and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') <> ''
   and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
     = regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g')
   and (
     select count(*)
       from public."clinic+b2b_customer_profiles" q
      where regexp_replace(coalesce(q.phone, ''), '\D', '', 'g')
          = regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g')
   ) = 1;

-- ---------------------------------------------------------------------------
-- A regra de visibilidade
-- ---------------------------------------------------------------------------
--
-- ⚠️ Dois argumentos, e **sem** `default`. Com `default null`, a chamada de um
-- argumento casaria com as duas versões e o Postgres recusaria por ambiguidade,
-- derrubando toda leitura de pedido. A versão antiga sai no fim do arquivo,
-- depois que as duas policies deixam de apontar para ela.

create or replace function public.clinic_b2b_can_view_order(
  p_customer_cnpj text,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  SELECT
    public.clinic_b2b_is_internal_staff()
    -- O dono, quando o pedido sabe quem é.
    OR (p_user_id IS NOT NULL AND p_user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public."clinic+b2b_customer_profiles" cp
      WHERE cp.user_id = auth.uid()
        -- ⚠️ Funcionário não enxerga por CNPJ.
        --
        -- O CNPJ do pedido dele é o da Clinic+, compartilhado com outros 96.
        -- Deixá-lo aqui é o vazamento. Ele vê o que é dele pelo `user_id` acima.
        AND coalesce(cp.customer_type, '') <> 'funcionario'
        AND (
          regexp_replace(coalesce(cp.cnpj, ''), '\D', '', 'g') = regexp_replace(coalesce(p_customer_cnpj, ''), '\D', '', 'g')
          OR regexp_replace(coalesce(cp.linked_company_cnpj, ''), '\D', '', 'g') = regexp_replace(coalesce(p_customer_cnpj, ''), '\D', '', 'g')
        )
    );
$$;

grant execute on function public.clinic_b2b_can_view_order(text, uuid) to anon, authenticated;

drop policy if exists "Clinic B2B customers can view own orders"
  on public."clinic+b2b_orders";

create policy "Clinic B2B customers can view own orders"
  on public."clinic+b2b_orders"
  for select to authenticated
  using (clinic_b2b_can_view_order(customer_cnpj, user_id));

-- A linha do tempo segue a mesma regra do pedido. Sem isto, o funcionário
-- perderia a lista e continuaria lendo o histórico do colega por dentro.
drop policy if exists "Cliente lê o histórico do próprio pedido"
  on public."clinic+b2b_order_events";

create policy "Cliente lê o histórico do próprio pedido"
  on public."clinic+b2b_order_events"
  for select to authenticated
  using (
    exists (
      select 1
        from public."clinic+b2b_orders" o
       where o.id = "clinic+b2b_order_events".order_id
         and public.clinic_b2b_can_view_order(o.customer_cnpj, o.user_id)
    )
  );

drop function if exists public.clinic_b2b_can_view_order(text);

-- ---------------------------------------------------------------------------
-- Ninguém grava pedido no nome de outra pessoa
-- ---------------------------------------------------------------------------
--
-- `user_id` decide quem vê o pedido, então não pode ser um campo que o
-- navegador preenche com o que quiser. A condição original — ter perfil, ou ser
-- da equipe — continua inteira; o que entra é a checagem do dono.

drop policy if exists "Clinic B2B customers can insert orders"
  on public."clinic+b2b_orders";

create policy "Clinic B2B customers can insert orders"
  on public."clinic+b2b_orders"
  for insert to authenticated
  with check (
    (
      clinic_b2b_is_internal_staff()
      or exists (
        select 1 from public."clinic+b2b_customer_profiles" cp
         where cp.user_id = auth.uid()
      )
    )
    and (user_id is null or user_id = auth.uid())
  );
