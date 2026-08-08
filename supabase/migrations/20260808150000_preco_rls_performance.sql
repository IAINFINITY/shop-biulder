-- Leitura da tabela de preço: mesma regra, 20x mais rápida.
--
-- ## O que foi medido
--
-- Consultando `customer_price_overrides` com token de um cliente real, com os
-- mesmos filtros que a loja usa:
--
--   TPR própria (138 linhas) ....... 2823 ms
--   TPR de outro cliente (0 linhas)  2807 ms
--   sem filtro ..................... statement timeout (nem completa)
--
-- Com 570 linhas na tabela. Todo cliente paga isso a cada visita ao catálogo, e
-- o custo cresce junto com o catálogo.
--
-- ## Por que estava lento — duas causas somadas
--
-- **1. `auth.uid()` avaliado linha a linha.** É a armadilha classica de RLS no
-- Supabase: chamado direto dentro da policy, o planejador o trata como algo a
-- resolver por linha. Envolver em subconsulta — `(select auth.uid())` — o
-- transforma num InitPlan, calculado **uma vez** para a consulta inteira.
--
-- **2. As policies são permissivas, então todas são avaliadas.** Postgres soma
-- policies permissivas com OR: para cada linha, a do cliente E a interna rodam.
-- A interna chama `clinic_b2b_is_internal_staff()`, que chama `has_role()`, que
-- consulta `user_roles`. Eram 570 consultas de papel por leitura — para um
-- cliente que nunca sera staff.
--
-- **3. Sem índice em `proxis_tpr_id`.** A tabela só tinha a chave primária, em
-- `id`. Todo filtro por tabela de preço varria as 570 linhas.
--
-- ## O que NÃO muda
--
-- A lógica de quem enxerga o quê é copiada literalmente de `pg_policies`, com a
-- única diferença sendo o `(select ...)` em volta das chamadas. O isolamento
-- verificado em 2026-08-08 — cliente da TPR 8728 não lê 8729, 8744 nem 8745 —
-- foi reconferido depois desta migration.

-- ---------------------------------------------------------------------------
-- 1. A policy do cliente, com `auth.uid()` resolvido uma vez só
-- ---------------------------------------------------------------------------

drop policy if exists "Clinic B2B customers can read active price overrides"
  on public."clinic+b2b_customer_price_overrides";

create policy "Clinic B2B customers can read active price overrides"
  on public."clinic+b2b_customer_price_overrides"
  for select
  to authenticated
  using (
    active is true
    and exists (
      select 1
      from public."clinic+b2b_customer_profiles" cp
      where cp.user_id = (select auth.uid())
        and (
          -- Tabela negociada: casa pelo id da TPR.
          (
            "clinic+b2b_customer_price_overrides".proxis_tpr_id is not null
            and cp.proxis_tpr_id = "clinic+b2b_customer_price_overrides".proxis_tpr_id
          )
          -- Camada geral: casa pelo tipo de cliente, e tipo vazio nao casa nada.
          or (
            "clinic+b2b_customer_price_overrides".proxis_tpr_id is null
            and lower(btrim(coalesce(cp.customer_type, ''::text)))
                = lower(btrim(coalesce("clinic+b2b_customer_price_overrides".customer_type, ''::text)))
            and coalesce(cp.customer_type, ''::text) <> ''::text
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. As policies internas, com a checagem de papel resolvida uma vez só
-- ---------------------------------------------------------------------------

drop policy if exists "Clinic B2B internal read price overrides"
  on public."clinic+b2b_customer_price_overrides";
create policy "Clinic B2B internal read price overrides"
  on public."clinic+b2b_customer_price_overrides"
  for select to authenticated
  using ((select clinic_b2b_is_internal_staff()));

drop policy if exists "Clinic B2B internal insert price overrides"
  on public."clinic+b2b_customer_price_overrides";
create policy "Clinic B2B internal insert price overrides"
  on public."clinic+b2b_customer_price_overrides"
  for insert to authenticated
  with check ((select clinic_b2b_is_internal_staff()));

drop policy if exists "Clinic B2B internal update price overrides"
  on public."clinic+b2b_customer_price_overrides";
create policy "Clinic B2B internal update price overrides"
  on public."clinic+b2b_customer_price_overrides"
  for update to authenticated
  using ((select clinic_b2b_is_internal_staff()))
  with check ((select clinic_b2b_is_internal_staff()));

drop policy if exists "Clinic B2B internal delete price overrides"
  on public."clinic+b2b_customer_price_overrides";
create policy "Clinic B2B internal delete price overrides"
  on public."clinic+b2b_customer_price_overrides"
  for delete to authenticated
  using ((select clinic_b2b_is_internal_staff()));

-- ---------------------------------------------------------------------------
-- 3. Índices para os dois caminhos que a loja usa
-- ---------------------------------------------------------------------------
--
-- Parciais em `active`: a loja nunca pede linha inativa, e a propria policy
-- exige `active is true`. Índice menor, e que serve exatamente à consulta real.

create index if not exists "clinic+b2b_customer_price_overrides_tpr_idx"
  on public."clinic+b2b_customer_price_overrides" (proxis_tpr_id)
  where active;

create index if not exists "clinic+b2b_customer_price_overrides_tipo_idx"
  on public."clinic+b2b_customer_price_overrides" (customer_type)
  where active;

analyze public."clinic+b2b_customer_price_overrides";
