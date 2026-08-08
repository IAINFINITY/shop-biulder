-- O perfil do cliente passa a ser criado mesmo com confirmação de e-mail.
--
-- ## O defeito
--
-- `signUpCustomer` (src/hooks/useAuth.ts) só chamava `register_customer_profile`
-- **quando o cadastro devolvia sessão**:
--
--     if (signUpData.session?.user) { ... rpc('register_customer_profile') }
--
-- Com confirmação de e-mail ligada, `supabase.auth.signUp` devolve
-- `session: null` — a sessão só nasce depois que a pessoa clica no link. Ou
-- seja: **no fluxo normal do site, o perfil nunca era criado.** Nome, telefone,
-- empresa e CNPJ ficavam apenas em `raw_user_meta_data`, e ninguém os lia de
-- volta.
--
-- O efeito visível é a conta entrar e cair em "Falta completar seu cadastro",
-- com os dados que a pessoa acabou de digitar guardados a um palmo de distância.
--
-- Medido antes desta migration: **15 contas sem perfil**, de 123.
--
-- ## Por que gatilho, e não conserto só no cliente
--
-- O cliente pode fechar a aba entre confirmar o e-mail e voltar ao site. Um
-- conserto que dependa do navegador rodar na hora certa deixa o mesmo buraco,
-- só que menor. O gatilho fecha o caso: quem confirma e-mail ganha perfil, sem
-- depender de nada do outro lado.
--
-- ## A duplicação que isto evita
--
-- `register_customer_profile` usa `auth.uid()`, que dentro de um gatilho é nulo.
-- Copiar o corpo dela para o gatilho duplicaria três regras que já vivem lá: o
-- override de tipo de cliente por CNPJ, o `on conflict` e a criação do papel
-- `user`. Em vez disso, o miolo sai para uma função que recebe o id, e as duas
-- pontas passam a chamá-la.

/**
 * O miolo: grava o perfil de um usuario **explicito**.
 *
 * Nao consulta `auth.uid()` — quem chama diz de quem e o perfil. E o que permite
 * usar a mesma regra no gatilho (onde nao ha sessao) e na RPC do navegador.
 */
create or replace function clinic_b2b_gravar_perfil_do_cliente(
  p_user_id uuid,
  p_name text,
  p_phone text,
  p_company text,
  p_cnpj text,
  p_customer_type text,
  p_address_cep text default null,
  p_address_street text default null,
  p_address_number text default null,
  p_address_complement text default null,
  p_address_neighborhood text default null,
  p_address_city text default null,
  p_address_state text default null,
  p_address_ibge text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cnpj text;
  v_customer_type text;
  v_override_type text;
begin
  if p_user_id is null then
    raise exception 'Usuario nao informado';
  end if;

  v_cnpj := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  if length(v_cnpj) <> 14 then
    raise exception 'CNPJ invalido';
  end if;

  v_customer_type := lower(trim(coalesce(p_customer_type, 'cliente')));
  if v_customer_type not in ('cliente', 'lojista', 'distribuidor') then
    v_customer_type := 'cliente';
  end if;

  -- O tipo negociado para este CNPJ vence o que veio do formulario.
  select customer_type into v_override_type
    from public."clinic+b2b_customer_type_overrides"
   where cnpj = v_cnpj
   limit 1;

  if v_override_type is not null then
    v_customer_type := lower(trim(v_override_type));
  end if;

  insert into public."clinic+b2b_customer_profiles" (
    user_id, name, phone, company, cnpj, customer_type,
    address_cep, address_street, address_number, address_complement,
    address_neighborhood, address_city, address_state, address_ibge
  )
  values (
    p_user_id, trim(coalesce(p_name, '')), trim(coalesce(p_phone, '')),
    trim(coalesce(p_company, '')), v_cnpj, v_customer_type,
    coalesce(trim(p_address_cep), ''), coalesce(trim(p_address_street), ''),
    coalesce(trim(p_address_number), ''), coalesce(trim(p_address_complement), ''),
    coalesce(trim(p_address_neighborhood), ''), coalesce(trim(p_address_city), ''),
    coalesce(trim(p_address_state), ''), coalesce(trim(p_address_ibge), '')
  )
  on conflict (user_id) do update set
    name = excluded.name,
    phone = excluded.phone,
    company = excluded.company,
    cnpj = excluded.cnpj,
    customer_type = excluded.customer_type,
    address_cep = excluded.address_cep,
    address_street = excluded.address_street,
    address_number = excluded.address_number,
    address_complement = excluded.address_complement,
    address_neighborhood = excluded.address_neighborhood,
    address_city = excluded.address_city,
    address_state = excluded.address_state,
    address_ibge = excluded.address_ibge,
    updated_at = now();

  insert into public."clinic+b2b_user_roles" (user_id, role)
  values (p_user_id, 'user')
  on conflict (user_id, role) do nothing;
end;
$$;

-- A RPC do navegador continua com a mesma assinatura e o mesmo contrato: exige
-- sessao. Só deixou de repetir a regra.
create or replace function public.register_customer_profile(
  p_name text,
  p_phone text,
  p_company text,
  p_cnpj text,
  p_customer_type text,
  p_address_cep text default null,
  p_address_street text default null,
  p_address_number text default null,
  p_address_complement text default null,
  p_address_neighborhood text default null,
  p_address_city text default null,
  p_address_state text default null,
  p_address_ibge text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Nao autenticado';
  end if;

  perform clinic_b2b_gravar_perfil_do_cliente(
    v_user_id, p_name, p_phone, p_company, p_cnpj, p_customer_type,
    p_address_cep, p_address_street, p_address_number, p_address_complement,
    p_address_neighborhood, p_address_city, p_address_state, p_address_ibge
  );
end;
$$;

/**
 * Confirmou o e-mail: cria o perfil com o que foi digitado no cadastro.
 *
 * Os dados vivem em `raw_user_meta_data` desde o `signUp` — e o unico lugar onde
 * eles existem enquanto nao ha sessao.
 *
 * Sai calado quando nao ha CNPJ no metadata: conta criada pelo painel, ou antes
 * desta versao, nao tem o que aproveitar. Forcar erro ali quebraria a
 * confirmacao de e-mail de quem nao tem nada a ver com isso.
 */
create or replace function clinic_b2b_criar_perfil_ao_confirmar_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if new.email_confirmed_at is null then
    return null;
  end if;

  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return null;  -- ja estava confirmado; nada de novo aqui.
  end if;

  if length(regexp_replace(coalesce(v_meta ->> 'cnpj', ''), '\D', '', 'g')) <> 14 then
    return null;
  end if;

  if exists (
    select 1 from public."clinic+b2b_customer_profiles" where user_id = new.id
  ) then
    return null;  -- o navegador chegou primeiro; nao sobrescrever.
  end if;

  perform clinic_b2b_gravar_perfil_do_cliente(
    new.id,
    v_meta ->> 'name',
    v_meta ->> 'phone',
    v_meta ->> 'company',
    v_meta ->> 'cnpj',
    v_meta ->> 'customer_type'
  );

  return null;
exception when others then
  -- Mesma regra da trilha de auditoria: perder o perfil e ruim, impedir a
  -- confirmacao de e-mail e pior. O aviso deixa rastro no log do Postgres.
  raise warning '[perfil] falha ao criar perfil de %: %', new.id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists clinic_b2b_perfil_ao_confirmar_email on auth.users;
create trigger clinic_b2b_perfil_ao_confirmar_email
  after insert or update of email_confirmed_at on auth.users
  for each row execute function clinic_b2b_criar_perfil_ao_confirmar_email();

-- Recupera quem ficou pelo caminho.
--
-- Só as contas que têm CNPJ no metadata dão para recuperar. As demais (criadas
-- pelo painel, ou antes de o metadata existir) continuam caindo na tela
-- "Falta completar seu cadastro" — que é o lugar certo para elas.
do $$
declare
  v_conta record;
  v_total int := 0;
begin
  for v_conta in
    select u.id, u.raw_user_meta_data as meta
      from auth.users u
      left join public."clinic+b2b_customer_profiles" p on p.user_id = u.id
     where p.user_id is null
       and u.email_confirmed_at is not null
       and length(regexp_replace(coalesce(u.raw_user_meta_data ->> 'cnpj', ''), '\D', '', 'g')) = 14
  loop
    begin
      perform clinic_b2b_gravar_perfil_do_cliente(
        v_conta.id,
        v_conta.meta ->> 'name',
        v_conta.meta ->> 'phone',
        v_conta.meta ->> 'company',
        v_conta.meta ->> 'cnpj',
        v_conta.meta ->> 'customer_type'
      );
      v_total := v_total + 1;
    exception when others then
      raise warning '[perfil] nao recuperou %: %', v_conta.id, sqlerrm;
    end;
  end loop;

  raise notice '[perfil] perfis recuperados: %', v_total;
end;
$$;

revoke all on function clinic_b2b_gravar_perfil_do_cliente(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
