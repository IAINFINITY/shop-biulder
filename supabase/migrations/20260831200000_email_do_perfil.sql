-- O e-mail que existia e o painel não mostrava.
--
-- ## O sintoma
--
-- "por algum motivo nos clientes tem clientes que estão sem e-mail, sendo que
-- não era pra isso acontecer."
--
-- Não era mesmo, e não estavam. Medido em 31/08/2026:
--
--   143 perfis · 100 com `email` preenchido · **43 com a coluna vazia e o
--   e-mail presente em `auth.users`** · 0 sem e-mail em lugar nenhum.
--
-- Ou seja: nenhum cliente está sem e-mail. A coluna `email` do perfil é uma
-- **cópia** do que está na conta, preenchida no cadastro — e 43 perfis nasceram
-- por um caminho que não a preenchia (importação, criação pelo painel). O
-- navegador não alcança `auth.users`, então o painel lia a cópia vazia e
-- concluía que não havia e-mail.
--
-- ## Copiar, e não passar a ler de `auth`
--
-- A alternativa era o painel consultar `auth.users` por uma RPC. Seria mais
-- "correto" e é pior aqui: transformaria toda listagem de cliente numa consulta
-- ao schema de autenticação, com `security definer`, para buscar um dado que
-- não muda quase nunca. A cópia já era o desenho; o que faltava era mantê-la.
--
-- ## O gatilho é o que impede isto de voltar
--
-- Sem ele, o backfill conserta os 43 de hoje e o 44º nasce vazio de novo na
-- próxima importação. Ele preenche na criação e na troca de e-mail da conta.

-- ---------------------------------------------------------------------------
-- Os 43 de hoje
-- ---------------------------------------------------------------------------
update public."clinic+b2b_customer_profiles" p
   set email = u.email
  from auth.users u
 where u.id = p.user_id
   and nullif(trim(coalesce(p.email, '')), '') is null
   and u.email is not null;

-- ---------------------------------------------------------------------------
-- E os próximos
-- ---------------------------------------------------------------------------

-- Perfil criado sem e-mail busca o da conta.
create or replace function public.preencher_email_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.email, '')), '') is null then
    select u.email into new.email from auth.users u where u.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists preencher_email_do_perfil on public."clinic+b2b_customer_profiles";
create trigger preencher_email_do_perfil
  before insert or update of email, user_id on public."clinic+b2b_customer_profiles"
  for each row execute function public.preencher_email_do_perfil();

-- Conta que troca de e-mail leva o perfil junto.
--
-- Sem isto a cópia envelhece em silêncio: o atendimento escreveria para o
-- endereço antigo achando que é o atual, que é pior do que campo vazio — campo
-- vazio pelo menos se vê.
create or replace function public.propagar_email_para_o_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public."clinic+b2b_customer_profiles"
       set email = new.email
     where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists propagar_email_para_o_perfil on auth.users;
create trigger propagar_email_para_o_perfil
  after update of email on auth.users
  for each row execute function public.propagar_email_para_o_perfil();
