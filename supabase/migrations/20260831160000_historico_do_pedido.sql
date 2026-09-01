-- A linha do tempo do pedido: o que aconteceu, quando, e por quem.
--
-- ## O que motivou
--
-- Uma cliente escreveu em 31/08/2026:
--
--   > "fiz um pedido dia 28 de agosto de 2026 às 14:40, porém eu não consigo
--   >  acompanhar a evolução, também não recebi nenhum e-mail com informações ou
--   >  formas de pagamento."
--
-- O `status` do pedido é uma coluna só: guarda onde ele está, e apaga por onde
-- passou. Não havia como responder "o que aconteceu com o meu pedido" nem no
-- painel nem na conta — só "onde ele está agora".
--
-- ## Por que uma tabela, e não mais colunas
--
-- Colunas de data (`aprovado_em`, `enviado_em`…) parecem mais simples e envelhecem
-- mal: cada estado novo é uma migration, o pedido que volta atrás não tem onde
-- registrar isso, e ninguém consegue dizer **quem** mudou. Uma linha por evento
-- responde as três, e é o formato que todo histórico de pedido usa.
--
-- ## O registro é do servidor, não do navegador
--
-- O gatilho grava sozinho a cada mudança de `status`. Se dependesse do painel
-- chamar, bastaria uma tela antiga em cache — ou uma alteração feita direto no
-- banco — para o histórico mentir por omissão, que é a pior forma de mentir num
-- registro.

create table if not exists public."clinic+b2b_order_events" (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public."clinic+b2b_orders"(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  -- Quem mudou. `null` quando foi o próprio sistema (a criação do pedido).
  alterado_por uuid references auth.users(id) on delete set null,
  -- Texto opcional que o atendimento escreve ao mudar o estado. É o que permite
  -- dizer "combinamos boleto para o dia 5" em vez de só "mudou de estado".
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_events_order on public."clinic+b2b_order_events" (order_id, created_at desc);

alter table public."clinic+b2b_order_events" enable row level security;

-- O cliente lê o histórico **do próprio pedido**, e só ele.
--
-- Sem esta policy o histórico existiria e a conta do cliente não poderia
-- mostrá-lo — que é metade do motivo de a tabela existir.
drop policy if exists "Cliente lê o histórico do próprio pedido" on public."clinic+b2b_order_events";
create policy "Cliente lê o histórico do próprio pedido"
  on public."clinic+b2b_order_events" for select to authenticated
  -- A mesma regra que a tabela de pedidos usa, e não uma cópia da intenção
  -- dela: `clinic+b2b_orders` não tem coluna de usuário — quem vê o pedido é
  -- decidido por `clinic_b2b_can_view_order(customer_cnpj)`, porque um pedido
  -- pode ter sido feito sem conta e é reivindicado pelo CNPJ depois.
  --
  -- Reescrever essa lógica aqui garantiria que as duas divergissem: alguém
  -- ajustaria quem vê o pedido e o histórico dele continuaria com a regra velha,
  -- exposto ou escondido a mais.
  using (
    exists (
      select 1 from public."clinic+b2b_orders" o
      where o.id = order_id and public.clinic_b2b_can_view_order(o.customer_cnpj)
    )
  );

drop policy if exists "Equipe lê todo o histórico" on public."clinic+b2b_order_events";
create policy "Equipe lê todo o histórico"
  on public."clinic+b2b_order_events" for select to authenticated
  using (public.clinic_b2b_is_internal_staff());

-- Ninguém escreve por fora: só o gatilho, que é `security definer`.
-- Sem policy de INSERT, `authenticated` não consegue inserir — e é o que se quer.

create or replace function public.registrar_evento_do_pedido()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Na criação, um evento de entrada. Sem ele o histórico começaria no meio: o
  -- pedido apareceria na conta do cliente sem a linha "recebemos seu pedido",
  -- que é justamente a que ele procura primeiro.
  if tg_op = 'INSERT' then
    insert into public."clinic+b2b_order_events" (order_id, status_anterior, status_novo, alterado_por)
    values (new.id, null, coalesce(new.status, 'NOVO CARRINHO'), auth.uid());
    return new;
  end if;

  -- Só quando o estado muda de verdade. Salvar o pedido sem mexer no status
  -- (corrigir um endereço, por exemplo) não é evento, e encheria a linha do
  -- tempo de ruído que esconde o que importa.
  if new.status is distinct from old.status then
    insert into public."clinic+b2b_order_events" (order_id, status_anterior, status_novo, alterado_por)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists registrar_evento_do_pedido_insert on public."clinic+b2b_orders";
create trigger registrar_evento_do_pedido_insert
  after insert on public."clinic+b2b_orders"
  for each row execute function public.registrar_evento_do_pedido();

drop trigger if exists registrar_evento_do_pedido_update on public."clinic+b2b_orders";
create trigger registrar_evento_do_pedido_update
  after update on public."clinic+b2b_orders"
  for each row execute function public.registrar_evento_do_pedido();

-- ---------------------------------------------------------------------------
-- Os 44 pedidos que já existem ganham o primeiro evento
-- ---------------------------------------------------------------------------
--
-- Sem isto, a conta de quem comprou em abril mostraria um pedido sem nenhum
-- histórico — pior que não ter a funcionalidade, porque parece defeito. O evento
-- é datado com a criação do pedido, que é quando de fato aconteceu.
insert into public."clinic+b2b_order_events" (order_id, status_anterior, status_novo, alterado_por, created_at)
select o.id, null, coalesce(o.status, 'NOVO CARRINHO'), null, o.created_at
  from public."clinic+b2b_orders" o
 where not exists (
   select 1 from public."clinic+b2b_order_events" e where e.order_id = o.id
 );

comment on table public."clinic+b2b_order_events" is
  'Histórico de estados do pedido. Alimentado por gatilho, nunca pelo navegador. Criada em 31/08/2026 depois de uma cliente relatar que não conseguia acompanhar o pedido.';
