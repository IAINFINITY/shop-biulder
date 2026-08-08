-- Último uso de cada autenticador (§12).
--
-- ## O que faltava
--
-- A §12 pede que a gestão de autenticadores mostre **criação e último uso**. A
-- criação vem do `listFactors` do SDK. O último uso não vem de lugar nenhum:
-- `updated_at` de `auth.mfa_factors` marca alteração do registro, não uso, e a
-- trilha de `20260808100000` só observa `auth.mfa_factors` — cadastro e remoção.
--
-- Uso de fator acontece em `auth.mfa_challenges`: o desafio nasce sem
-- `verified_at` e recebe a data quando a pessoa acerta o código. É esse instante
-- que a §12 chama de último uso.
--
-- ## Por que um gatilho separado, e não estender o existente
--
-- `clinic_b2b_registrar_evento_auth` é genérica de propósito: serve a qualquer
-- tabela porque não cita campo nenhum. `auth.mfa_challenges` não tem `user_id`
-- — só `factor_id` — então precisa de uma busca em `auth.mfa_factors` que a
-- função genérica não faz. Estendê-la para este caso a devolveria ao defeito que
-- o comentário dela documenta.
--
-- ## O que NÃO entra
--
-- `auth.mfa_challenges` guarda `ip_address` e dados de sessão WebAuthn. Nada
-- disso é gravado: a §24 pede o mínimo, e o mínimo aqui é "qual fator, quando".

create or replace function clinic_b2b_registrar_uso_de_fator()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_tipo text;
begin
  -- Só o instante em que o desafio passa a verificado interessa. `is distinct
  -- from` cobre o insert já verificado (old é null) sem repetir em todo update
  -- posterior do mesmo registro.
  if new.verified_at is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.verified_at is not distinct from new.verified_at then
    return null;
  end if;

  select f.user_id, f.factor_type into v_user_id, v_tipo
  from auth.mfa_factors f
  where f.id = new.factor_id;

  if v_user_id is null then
    return null;
  end if;

  insert into "clinic+b2b_auth_events" (evento, user_id, ocorrido_em, detalhe)
  values (
    'fator_mfa_usado',
    v_user_id,
    new.verified_at,
    jsonb_strip_nulls(jsonb_build_object(
      -- O id do fator é o que liga o evento ao autenticador na tela. Não é
      -- segredo: o próprio dono já o recebe do `listFactors`.
      'factor_id', new.factor_id::text,
      'tipo_de_fator', v_tipo
    ))
  );
  return null;
exception when others then
  -- Mesma razão da trilha original: perder um registro é ruim, impedir a
  -- verificação do segundo fator é pior. `raise warning` deixa rastro no log do
  -- Postgres sem derrubar o login.
  raise warning '[auditoria] falha ao registrar uso de fator: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists clinic_b2b_fator_usado on auth.mfa_challenges;
create trigger clinic_b2b_fator_usado
  after insert or update on auth.mfa_challenges
  for each row execute function clinic_b2b_registrar_uso_de_fator();

-- Índice para a consulta da tela: eventos de uso de um usuário, do mais recente
-- para o mais antigo. O índice de `20260808100000` já cobre (user_id, tempo),
-- mas este filtra por evento e evita varrer sessões — que são a maioria das
-- linhas da tabela.
create index if not exists "clinic+b2b_auth_events_uso_de_fator_idx"
  on "clinic+b2b_auth_events" (user_id, ocorrido_em desc)
  where evento = 'fator_mfa_usado';

/**
 * Último uso por fator, só do próprio chamador.
 *
 * A tabela tem RLS ligada e nenhuma policy — de propósito, porque deixar a
 * trilha inteira legível entregaria o padrão de acesso de cada conta a quem já
 * entrou. Esta função é a abertura mínima que a §12 exige: `security definer`,
 * filtrada por `auth.uid()`, devolvendo só data de uso e nada mais.
 *
 * Não recebe parâmetro de propósito. Se recebesse um `user_id`, seria uma função
 * que aceita ler o de outra pessoa e depende de conferir — e a conferência que
 * não existe é a que vaza.
 */
create or replace function clinic_b2b_ultimo_uso_dos_fatores()
returns table (factor_id text, ultimo_uso timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    e.detalhe ->> 'factor_id' as factor_id,
    max(e.ocorrido_em) as ultimo_uso
  from "clinic+b2b_auth_events" e
  where e.evento = 'fator_mfa_usado'
    and e.user_id = auth.uid()
    and e.detalhe ->> 'factor_id' is not null
  group by 1;
$$;

comment on function clinic_b2b_ultimo_uso_dos_fatores() is
  'Último uso de cada autenticador do próprio chamador (§12). Nunca devolve dado de outro usuário.';

-- Anônimo não tem autenticador para consultar.
revoke all on function clinic_b2b_ultimo_uso_dos_fatores() from public, anon;
grant execute on function clinic_b2b_ultimo_uso_dos_fatores() to authenticated;
