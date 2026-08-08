-- "Desativar usuário" passa a desativar de verdade.
--
-- ## O defeito
--
-- O painel grava `is_active = false` em `clinic+b2b_admin_users` e mostra
-- "O usuário perderá acesso ao painel". **Nada no sistema lia esse campo.**
--
-- `has_role()` consultava apenas `clinic+b2b_user_roles` — e é ela que decide
-- tudo: `api/_auth.ts`, `clinic_b2b_is_internal_staff()` e, por consequência,
-- todas as políticas de RLS do admin. Um usuário "desativado" continuava
-- entrando no painel, lendo o preço de todos os clientes e lançando pedido no
-- ERP.
--
-- Isso viola dois pontos do padrão de autenticação de uma vez:
--
--   §28 — "Suspender ou desativar acesso DEVE impedir novas autenticações e
--          encerrar todas as sessões ativas"
--   §31 — antipadrão nomeado: "conta desativada com sessões ainda válidas"
--
-- E há um agravante fora do padrão: **a interface afirmava que tinha
-- funcionado**. Quem desativasse um ex-funcionário sairia da tela achando que
-- resolveu.
--
-- ## As duas metades da correção
--
-- 1. `has_role` passa a recusar quem está marcado inativo — bloqueia autenticação
--    nova.
-- 2. Um gatilho encerra as sessões abertas no momento da desativação — sem ele,
--    quem já estava logado seguiria logado até o token expirar.
--
-- Só as duas juntas cumprem a §28. A primeira sozinha deixaria a sessão viva; a
-- segunda sozinha deixaria a pessoa entrar de novo.

/**
 * `has_role` agora considera a desativação.
 *
 * A regra é "negar apenas quando há registro explícito de desativação":
 * **ausência de linha em `admin_users` não bloqueia**. Nem todo portador de papel
 * tem cadastro ali, e tratar ausência como desativado tiraria do ar quem nunca
 * foi desativado — trocaria um furo de segurança por uma interrupção.
 */
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."clinic+b2b_user_roles" ur
    WHERE ur.user_id = _user_id
      AND (
        lower(coalesce(ur.role, '')) = lower(coalesce(_role, ''))
        OR (
          lower(coalesce(_role, '')) = 'admin'
          AND lower(coalesce(ur.role, '')) IN (
            'superadmin',
            'admin',
            'consultor',
            'representante',
            'admin_atendimento'
          )
        )
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public."clinic+b2b_admin_users" au
    WHERE au.user_id = _user_id
      AND au.is_active IS FALSE
  );
$function$;

comment on function public.has_role(uuid, text) is
  'Papel efetivo do usuário. Recusa quem está marcado is_active = false em clinic+b2b_admin_users (§28). Ausência de linha ali não bloqueia.';

/**
 * Desativar encerra as sessões abertas.
 *
 * Vive como gatilho, e não no código do painel, porque a §28 fala de **efeito**,
 * não de caminho: quem desativar por SQL, por script de RH ou por uma tela futura
 * precisa produzir o mesmo resultado. Regra no aplicativo se aplica a um caminho
 * só.
 *
 * Apagar de `auth.sessions` também dispara `clinic_b2b_sessao_revogada`, então a
 * revogação entra na trilha de auditoria sem código extra.
 */
create or replace function clinic_b2b_encerrar_sessoes_ao_desativar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_active is false and coalesce(old.is_active, true) is true then
    delete from auth.sessions where user_id = new.user_id;

    insert into "clinic+b2b_auth_events" (evento, user_id, detalhe)
    values ('acesso_desativado', new.user_id, jsonb_build_object('origem', 'admin_users'));
  end if;
  return null;
exception when others then
  -- Não pode impedir a desativação: melhor desativar e falhar em encerrar a
  -- sessão do que deixar o usuário ativo porque a limpeza deu erro. O aviso vai
  -- para o log do Postgres.
  raise warning '[desativacao] falha ao encerrar sessoes de %: %', new.user_id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists clinic_b2b_desativacao_encerra_sessoes on "clinic+b2b_admin_users";
create trigger clinic_b2b_desativacao_encerra_sessoes
  after update of is_active on "clinic+b2b_admin_users"
  for each row execute function clinic_b2b_encerrar_sessoes_ao_desativar();
