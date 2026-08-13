-- Gravar o perfil não pode apagar o endereço da empresa.
--
-- ## O defeito
--
-- `clinic_b2b_gravar_perfil_do_cliente` é usada em dois lugares: pelo gatilho
-- que cria o perfil depois da confirmação de e-mail, e pela RPC
-- `register_customer_profile`, que a tela "Dados da empresa" chama quando a
-- pessoa completa ou edita o próprio cadastro.
--
-- Os oito parâmetros de endereço têm `default null`, e **o navegador nunca os
-- envia** — a tela manda apenas nome, telefone, empresa, CNPJ e tipo. O
-- `on conflict do update` gravava `address_cep = excluded.address_cep` sem
-- condição nenhuma, então cada passagem por ali escrevia string vazia por cima
-- do que existia.
--
-- Sozinho isso não incomodava, porque ninguém preenchia aquelas colunas. Passou
-- a incomodar agora que o endereço da empresa vem da Receita pelo CNPJ: a
-- pessoa corrigia o telefone e **perdia o endereço cadastral**. O site
-- repreencheria, mas só na sessão seguinte — a tentativa é uma por sessão, de
-- propósito, para respeitar o limite da API.
--
-- ## A correção
--
-- Campo de endereço vazio na entrada deixa de significar "apague"; passa a
-- significar "não mexa". Quem quiser limpar de fato continua podendo, por
-- `update` direto — o que o site faz quando precisa forçar nova busca.
--
-- O resto do corpo é idêntico ao da migration `20260808140000`.

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

    -- O CEP manda no conjunto: ou o chamador trouxe um endereço, e ele entra
    -- inteiro, ou não trouxe, e nada do endereço é tocado. Decidir campo a
    -- campo permitiria misturar a rua de um endereço com a cidade de outro.
    address_cep = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_cep
      else "clinic+b2b_customer_profiles".address_cep end,
    address_street = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_street
      else "clinic+b2b_customer_profiles".address_street end,
    address_number = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_number
      else "clinic+b2b_customer_profiles".address_number end,
    address_complement = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_complement
      else "clinic+b2b_customer_profiles".address_complement end,
    address_neighborhood = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_neighborhood
      else "clinic+b2b_customer_profiles".address_neighborhood end,
    address_city = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_city
      else "clinic+b2b_customer_profiles".address_city end,
    address_state = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_state
      else "clinic+b2b_customer_profiles".address_state end,
    address_ibge = case
      when coalesce(trim(excluded.address_cep), '') <> '' then excluded.address_ibge
      else "clinic+b2b_customer_profiles".address_ibge end,

    updated_at = now();

  insert into public."clinic+b2b_user_roles" (user_id, role)
  values (p_user_id, 'user')
  on conflict (user_id, role) do nothing;
end;
$$;
