-- Quem nao quer campanha pode desligar.
--
-- ## Por que precisa existir
--
-- As notificacoes de campanha sao marketing, e marketing nao cabe em execucao de
-- contrato. A base escolhida foi legitimo interesse (art. 7, IX), e o art. 10
-- exige, para ela, so o estritamente necessario (§ 1) e transparencia reforcada
-- (§ 2). Na pratica isso quer dizer: e preciso poder recusar. Ate aqui nao havia
-- como — nao existia opt-out em lugar nenhum do sistema.
--
-- ## O corte: campanha versus aviso dirigido
--
-- Desligar campanha **nao** silencia notificacao endereçada. A tabela ja separa
-- as duas pelo `target_user_id`:
--
--   target_user_id IS NULL  -> vai para todo mundo. E a campanha. Desligavel.
--   target_user_id = alguem -> foi escrita para aquela pessoa. Continua chegando.
--
-- Misturar as duas seria pior para o cliente que para nos: quem recusa
-- propaganda nao esta recusando aviso sobre o proprio pedido.
--
-- ## Visitante anonimo
--
-- Continua vendo campanha: nao ha perfil onde guardar recusa, e a vitrine
-- publica depende disso. O `auth.uid() is null` no meio da policy e o que
-- preserva esse caso — sem ele, o catalogo deslogado perderia os avisos.

-- ---------------------------------------------------------------------------
-- 1. A preferencia.
-- ---------------------------------------------------------------------------
--
-- `default true` porque a base legal e legitimo interesse, nao consentimento:
-- o tratamento comeca licito e a pessoa pode interromper. Se um dia virar
-- consentimento, o default tem de virar `false` — sao regimes diferentes, e a
-- diferenca aparece exatamente aqui.

alter table public."clinic+b2b_customer_profiles"
  add column if not exists aceita_campanhas boolean not null default true;

comment on column public."clinic+b2b_customer_profiles".aceita_campanhas is
  'Recebe notificacao de campanha (as que nao tem destinatario). Aviso dirigido chega de qualquer forma. Default true: a base e legitimo interesse, com direito de recusa.';

-- ---------------------------------------------------------------------------
-- 2. A pessoa liga e desliga sozinha.
-- ---------------------------------------------------------------------------
--
-- RPC propria em vez de policy de update na tabela: a policy abriria a linha
-- inteira para escrita, e aqui so uma coluna pode mudar.

create or replace function public.clinic_b2b_definir_aceite_campanhas(p_aceita boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Nao autenticado';
  end if;

  update public."clinic+b2b_customer_profiles"
     set aceita_campanhas = coalesce(p_aceita, true),
         updated_at = now()
   where user_id = v_uid;

  return coalesce(p_aceita, true);
end;
$$;

revoke all on function public.clinic_b2b_definir_aceite_campanhas(boolean) from public;
grant execute on function public.clinic_b2b_definir_aceite_campanhas(boolean) to authenticated;

comment on function public.clinic_b2b_definir_aceite_campanhas(boolean) is
  'Liga ou desliga o recebimento de campanhas para quem chama. So mexe na propria linha.';

-- ---------------------------------------------------------------------------
-- 3. A leitura passa a respeitar a recusa.
-- ---------------------------------------------------------------------------
--
-- No banco, e nao no front: filtro de tela e sugestao, policy e regra. Quem
-- recusou nao recebe a linha nem chamando a API direto.

drop policy if exists "Clinic B2B public read active notifications"
  on public."clinic+b2b_catalog_notifications";

create policy "Clinic B2B public read active notifications"
  on public."clinic+b2b_catalog_notifications"
  for select
  to anon, authenticated
  using (
    active is true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (
      -- Aviso dirigido: chega sempre a quem foi endereçado.
      target_user_id = (select auth.uid())
      or (
        target_user_id is null
        and (
          -- Visitante anonimo nao tem onde guardar recusa.
          (select auth.uid()) is null
          -- `coalesce` cobre quem ainda nao tem perfil: recebe, como antes.
          or coalesce(
            (select p.aceita_campanhas
               from public."clinic+b2b_customer_profiles" p
              where p.user_id = (select auth.uid())),
            true
          )
        )
      )
    )
  );
