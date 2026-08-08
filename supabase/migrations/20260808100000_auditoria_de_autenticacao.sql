-- Trilha de eventos de autenticação (§24).
--
-- ## Por que existe
--
-- A §24 lista o mínimo a registrar: login, falha, troca de senha, troca de email,
-- mudança de MFA, criação e revogação de sessão. Sem isso não há como investigar
-- um incidente nem alimentar os alertas da §25.
--
-- `auth.audit_log_entries`, a tabela nativa do Supabase, foi verificada em
-- 2026-08-07: **existe e está vazia**, com 110 contas cadastradas. A plataforma
-- não está gravando, então o item não se fecha por configuração.
--
-- ## Por que gatilho no banco, e não registro pelo navegador
--
-- Trilha escrita pelo cliente é forjável por quem controla o cliente — e uma
-- trilha que o próprio auditado pode escrever não serve como evidência. O gatilho
-- roda dentro da transação do Supabase Auth, em `auth.sessions` e
-- `auth.mfa_factors`: ninguém no navegador consegue impedi-lo nem inventá-lo.
--
-- ## O que NÃO entra aqui, por decisão
--
-- Nada de token, senha, hash, código TOTP ou cabeçalho de requisição. A §24 tem
-- uma lista de "nunca registrar", e trilha de auditoria que vaza segredo vira o
-- próprio alvo. Só ficam: quem, o quê, quando.
--
-- Falha de login **não** passa por aqui: o Supabase não cria sessão quando a
-- senha está errada, então não há linha para o gatilho ver. Esse evento fica
-- pendente e depende de webhook do Auth ou de registro na borda.

create table if not exists "clinic+b2b_auth_events" (
  id uuid primary key default gen_random_uuid(),
  ocorrido_em timestamptz not null default now(),
  evento text not null,
  user_id uuid,
  -- Contexto mínimo e não sensível: id da sessão, tipo de fator. Nunca segredo.
  detalhe jsonb not null default '{}'::jsonb
);

comment on table "clinic+b2b_auth_events" is
  'Trilha de eventos de autenticação (§24). Escrita só por gatilho no schema auth. Nunca contém token, senha, hash ou código.';

create index if not exists "clinic+b2b_auth_events_user_idx"
  on "clinic+b2b_auth_events" (user_id, ocorrido_em desc);
create index if not exists "clinic+b2b_auth_events_tempo_idx"
  on "clinic+b2b_auth_events" (ocorrido_em desc);

-- RLS ligada e nenhuma policy: nem anon nem authenticated leem ou escrevem. O
-- service role passa por cima e é o único que precisa. Deixar a trilha legível
-- entregaria o padrão de acesso de cada conta a quem já entrou.
alter table "clinic+b2b_auth_events" enable row level security;

/**
 * Uma função só para todas as tabelas — e por isso ela NÃO pode citar campo
 * específico.
 *
 * A primeira versão tinha `new.factor_type` dentro de um `case` que só valia para
 * `mfa_factors`. Num gatilho sobre `auth.sessions` esse campo não existe, e o
 * plpgsql resolve os campos ao planejar a expressão inteira — não só o ramo
 * verdadeiro. O resultado era erro em todo login, engolido pelo `exception`, e
 * zero eventos gravados com o gatilho aparentemente instalado.
 *
 * `to_jsonb(new)` resolve: converte o registro inteiro e depois se extrai por
 * chave, o que funciona em qualquer tabela e devolve `null` para chave ausente.
 */
create or replace function clinic_b2b_registrar_evento_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registro jsonb;
  v_user_id uuid;
begin
  v_registro := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_user_id := (v_registro ->> 'user_id')::uuid;

  insert into "clinic+b2b_auth_events" (evento, user_id, detalhe)
  values (
    tg_argv[0],
    v_user_id,
    -- Só chaves não sensíveis, nomeadas uma a uma. `to_jsonb` do registro
    -- inteiro traria o hash do fator e o segredo do TOTP junto.
    jsonb_strip_nulls(jsonb_build_object(
      'tipo_de_fator', v_registro ->> 'factor_type',
      'status', v_registro ->> 'status'
    ))
  );
  return null;  -- `after` trigger: o retorno é ignorado.
exception when others then
  -- A trilha NUNCA pode derrubar o login: perder um registro é ruim, impedir
  -- todo mundo de entrar é pior.
  --
  -- Mas o silêncio total foi o que escondeu o defeito acima. `raise warning`
  -- mantém o login de pé E deixa rastro no log do Postgres.
  raise warning '[auditoria] falha ao registrar %: %', tg_argv[0], sqlerrm;
  return null;
end;
$$;

drop trigger if exists clinic_b2b_sessao_criada on auth.sessions;
create trigger clinic_b2b_sessao_criada
  after insert on auth.sessions
  for each row execute function clinic_b2b_registrar_evento_auth('sessao_criada');

drop trigger if exists clinic_b2b_sessao_revogada on auth.sessions;
create trigger clinic_b2b_sessao_revogada
  after delete on auth.sessions
  for each row execute function clinic_b2b_registrar_evento_auth('sessao_revogada');

drop trigger if exists clinic_b2b_fator_alterado on auth.mfa_factors;
create trigger clinic_b2b_fator_alterado
  after insert or update on auth.mfa_factors
  for each row execute function clinic_b2b_registrar_evento_auth('fator_mfa_alterado');

drop trigger if exists clinic_b2b_fator_removido on auth.mfa_factors;
create trigger clinic_b2b_fator_removido
  after delete on auth.mfa_factors
  for each row execute function clinic_b2b_registrar_evento_auth('fator_mfa_removido');

-- Troca de senha: `auth.users.encrypted_password` muda. Compara-se o hash com o
-- anterior apenas para saber SE mudou — o valor nunca é gravado.
create or replace function clinic_b2b_registrar_troca_de_credencial()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    insert into "clinic+b2b_auth_events" (evento, user_id) values ('senha_alterada', new.id);
  end if;
  if new.email is distinct from old.email then
    insert into "clinic+b2b_auth_events" (evento, user_id) values ('email_alterado', new.id);
  end if;
  return null;
exception when others then
  raise warning '[auditoria] falha ao registrar troca de credencial: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists clinic_b2b_credencial_alterada on auth.users;
create trigger clinic_b2b_credencial_alterada
  after update on auth.users
  for each row execute function clinic_b2b_registrar_troca_de_credencial();
