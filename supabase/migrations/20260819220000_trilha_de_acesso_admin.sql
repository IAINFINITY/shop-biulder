-- Quem abriu o cadastro de qual cliente.
--
-- ## A lacuna que isto fecha
--
-- A RLS deixa todo admin ler o perfil de qualquer cliente — o que e correto para
-- o trabalho deles. O que nao existia era **registro** disso. Se um dia fosse
-- preciso responder "quem viu os dados deste cliente", nao havia resposta: a
-- trilha `clinic+b2b_auth_events` cobre autenticacao, nao leitura de cadastro.
--
-- Para a LGPD isso pesa em dois pontos: o art. 46 pede medida de seguranca
-- proporcional, e o art. 48 exige dimensionar o alcance de um incidente. Sem
-- saber quem acessou o que, a segunda pergunta nao tem resposta.
--
-- ## O limite desta versao, dito sem rodeio
--
-- O registro e disparado pela interface, entao cobre o caminho normal — abrir a
-- ficha de um cliente no painel. **Nao e prova a prova de adulteracao**: um admin
-- que chame a API por fora le o perfil sem passar por aqui.
--
-- O `20260808100000` registra, sobre a trilha de autenticacao, que trilha escrita
-- pelo cliente e forjavel — e a critica vale aqui. A diferenca e que ali havia
-- alternativa (gatilho no banco) e aqui nao: o Postgres nao tem gatilho de
-- `select`.
--
-- Fechar isso de verdade exige rotear toda leitura administrativa por uma funcao
-- `security definer` que registre, e revogar o `select` direto do admin sobre a
-- tabela. E mudanca maior, que mexe na listagem, na busca e nos filtros do
-- painel — fica registrada como proximo passo, nao feita as escondidas.
--
-- Mesmo assim vale ter: cobre o uso real, cria dissuasao, e e a base sobre a
-- qual a versao inviolavel se apoia depois.

create table if not exists "clinic+b2b_admin_access_events" (
  id uuid primary key default gen_random_uuid(),
  ocorrido_em timestamptz not null default now(),
  admin_user_id uuid not null,
  alvo_user_id uuid,
  alvo_cnpj text,
  acao text not null
);

comment on table "clinic+b2b_admin_access_events" is
  'Registro de acesso administrativo a cadastro de cliente. Escrito pela funcao clinic_b2b_registrar_acesso_admin. Cobre o caminho da interface, nao e prova contra adulteracao.';

create index if not exists "clinic+b2b_admin_access_alvo_idx"
  on "clinic+b2b_admin_access_events" (alvo_user_id, ocorrido_em desc);
create index if not exists "clinic+b2b_admin_access_admin_idx"
  on "clinic+b2b_admin_access_events" (admin_user_id, ocorrido_em desc);
create index if not exists "clinic+b2b_admin_access_tempo_idx"
  on "clinic+b2b_admin_access_events" (ocorrido_em desc);

-- RLS ligada e nenhuma policy: nem anon nem authenticated leem. So o service
-- role passa por cima, e e o unico que precisa. Trilha legivel por quem ela
-- audita perde o sentido.
alter table "clinic+b2b_admin_access_events" enable row level security;

-- ---------------------------------------------------------------------------
-- O registro.
-- ---------------------------------------------------------------------------
--
-- Quem registra e sempre `auth.uid()` — nunca um parametro. Aceitar o id do
-- admin como argumento deixaria qualquer um escrever linha em nome de outro, e
-- uma trilha que se pode forjar contra terceiro e pior que nenhuma.

create or replace function public.clinic_b2b_registrar_acesso_admin(
  p_alvo_user_id uuid,
  p_alvo_cnpj text,
  p_acao text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := (select auth.uid());
begin
  if v_admin is null then
    return;
  end if;

  -- Cliente comum navegando no proprio cadastro nao gera linha: a trilha e de
  -- acesso administrativo, e enche-la de ruido a torna inutil na hora de ler.
  if not public.clinic_b2b_is_internal_staff() then
    return;
  end if;

  insert into public."clinic+b2b_admin_access_events" (admin_user_id, alvo_user_id, alvo_cnpj, acao)
  values (v_admin, p_alvo_user_id, nullif(btrim(coalesce(p_alvo_cnpj, '')), ''), coalesce(nullif(btrim(p_acao), ''), 'abrir-cadastro'));
end;
$$;

revoke all on function public.clinic_b2b_registrar_acesso_admin(uuid, text, text) from public;
grant execute on function public.clinic_b2b_registrar_acesso_admin(uuid, text, text) to authenticated;

comment on function public.clinic_b2b_registrar_acesso_admin(uuid, text, text) is
  'Registra que um membro interno abriu o cadastro de um cliente. O autor vem de auth.uid(), nunca de parametro.';
