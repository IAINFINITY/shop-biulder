-- Um tipo de conta passa a poder **apontar para uma tabela de preço**.
--
-- ## O pedido
--
-- "a gente pode criar um tipo de cliente, a gente pode associar preços a esse
-- tipo de cliente e se a gente quiser não associar preços, a gente pode fazer
-- com que os preços do cliente venham de uma tabela. Porque eu poderia ter
-- vários tipos de cliente que usam a mesma tabela."
--
-- ## O que existia
--
-- Duas coisas separadas, e nenhuma ligação entre elas:
--
-- - **preço do tipo** — linhas de `customer_price_overrides` com
--   `proxis_tpr_id = null` e `customer_type = 'funcionario'`, por exemplo;
-- - **tabela negociada da conta** — `customer_profiles.proxis_tpr_id`, por
--   conta, uma a uma.
--
-- Faltava o meio-termo: "todo lojista paga pela tabela 8729". Só dava atribuindo
-- a tabela conta por conta — e um lojista novo nascia fora dela, em silêncio.
--
-- ## A coluna, e o que ela significa
--
-- `price_table_id NULL` → o tipo tem **preços próprios** (o de sempre).
-- `price_table_id = N`  → os preços do tipo **vêm da tabela N**.
--
-- Vários tipos podem apontar para a mesma tabela; é o ponto do pedido.
--
-- ## ⚠️ A tabela negociada da conta continua ganhando
--
-- A ordem passa a ser, do mais específico para o mais geral:
--
--   1. tabela negociada **da conta** (`profiles.proxis_tpr_id`)
--   2. tabela **do tipo** (`customer_types.price_table_id`)
--   3. preços próprios do tipo
--   4. preço de cadastro do produto
--
-- Sem isso, ligar um tipo a uma tabela apagaria a negociação individual de quem
-- já tem uma — 35 contas hoje.

alter table public."clinic+b2b_customer_types"
  add column if not exists price_table_id integer,
  add column if not exists updated_at timestamptz not null default now();

comment on column public."clinic+b2b_customer_types".price_table_id is
  'Tabela de onde vêm os preços deste tipo. NULL = o tipo tem preços próprios em customer_price_overrides.';

-- ⚠️ **Sem foreign key, de propósito.**
--
-- `clinic+b2b_price_tables` guarda o `tpr_id` como chave, e a coluna equivalente
-- em `customer_price_overrides` (`proxis_tpr_id`) também não tem FK — foi assim
-- que as tabelas puderam ser apagadas por regra em 01/09 sem cascata escondida.
-- Criar a amarra só aqui daria duas regras diferentes para o mesmo número.
--
-- O que impede o ponteiro solto é o gatilho abaixo, que age no caso que importa:
-- apagar uma tabela que algum tipo usa.
create index if not exists idx_customer_types_price_table
  on public."clinic+b2b_customer_types" (price_table_id)
  where price_table_id is not null;

/**
 * Apagar uma tabela que um tipo usa deixaria o tipo apontando para o vazio —
 * e todo cliente daquele tipo cairia no preço de cadastro sem ninguém pedir.
 * Melhor recusar e obrigar a decisão explícita.
 */
create or replace function public.impedir_apagar_tabela_em_uso()
returns trigger
language plpgsql
as $$
declare
  tipos text;
begin
  select string_agg(name, ', ')
    into tipos
    from public."clinic+b2b_customer_types"
   where price_table_id = old.tpr_id;

  if tipos is not null then
    raise exception 'A tabela % está em uso pelo(s) tipo(s): %. Troque a origem de preço desses tipos antes de apagar.',
      old.tpr_id, tipos;
  end if;

  return old;
end;
$$;

drop trigger if exists impedir_apagar_tabela_em_uso on public."clinic+b2b_price_tables";
create trigger impedir_apagar_tabela_em_uso
  before delete on public."clinic+b2b_price_tables"
  for each row execute function public.impedir_apagar_tabela_em_uso();

-- Cada admin muda o próprio catálogo de tipos; a leitura é de todo mundo que
-- está logado, porque o preço do catálogo depende dela.
drop policy if exists "Equipe edita os tipos de conta" on public."clinic+b2b_customer_types";
create policy "Equipe edita os tipos de conta"
  on public."clinic+b2b_customer_types" for update to authenticated
  using (public.clinic_b2b_is_internal_staff())
  with check (public.clinic_b2b_is_internal_staff());
