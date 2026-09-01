-- O sino do painel: o que aconteceu enquanto você não estava olhando.
--
-- ## O pedido
--
-- "eu quero realmente tipo um iconezinho de notificação (…) que aquele botão de
-- notificação ele seja pra várias coisas: entrou um cliente novo, entrou um
-- funcionário novo, teve um pedido novo, banner novo criado, imagem criada (…)
-- e cada administrador configuraria do seu jeito."
--
-- ## Três tabelas, e o motivo de não serem uma
--
-- 1. **`admin_events`** — o que aconteceu. Um fato, uma linha, igual para todo
--    mundo. Ninguém "tem" um pedido novo; o pedido novo simplesmente existe.
--
-- 2. **`admin_event_reads`** — quem já viu o quê. É por pessoa, e é o que o
--    pedido chama de "notificação por usuário".
--
-- 3. **`admin_notification_prefs`** — quem quer ser avisado de quê.
--
-- Juntar 1 e 2 numa coluna `lida boolean` no evento faria o primeiro admin que
-- abrisse o sino marcar como lido para os outros quatro. É exatamente o erro que
-- a caixa de mensagens **evita** de propósito.
--
-- ## ⚠️ Aqui "lido por pessoa" é o desenho certo — na caixa de mensagens não é
--
-- Parecem a mesma coisa e são opostas:
--
-- | | caixa de mensagens | sino do painel |
-- |---|---|---|
-- | o que é | trabalho da equipe | ciência de cada um |
-- | "eu vi" quer dizer | nada — o cliente continua esperando | tudo — eu já sei |
-- | se some para todos | ⚠️ o cliente fica sem resposta | nada se perde |
--
-- Responder uma conversa é um fato do mundo; ver um aviso é um fato da cabeça de
-- quem viu. Por isso `ultima_mensagem_de` lá (objetivo, compartilhado) e
-- `lida_em` aqui (subjetivo, por pessoa).
--
-- ## Preferência: a ausência de linha é "ligado"
--
-- Só existe linha quando alguém **muda** o padrão. Assim um tipo de aviso novo
-- já nasce ligado para todo mundo, sem precisar de backfill — e desligar
-- continua sendo uma escolha explícita, gravada.

-- ---------------------------------------------------------------------------
-- 1. O que aconteceu
-- ---------------------------------------------------------------------------

create table if not exists public."clinic+b2b_admin_events" (
  id uuid primary key default gen_random_uuid(),
  -- `pedido_novo`, `cliente_novo`, `funcionario_novo`, `mensagem_nova`,
  -- `banner_novo`, `avaliacao_nova`, `admin_novo`. Texto e não enum: um tipo
  -- novo é uma linha a mais, e não uma migration que trava a tabela.
  tipo text not null,
  titulo text not null,
  descricao text,
  -- Qual seção do painel abrir no clique. É o que transforma o aviso em atalho.
  secao text,
  referencia_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_events_recentes
  on public."clinic+b2b_admin_events" (created_at desc);

alter table public."clinic+b2b_admin_events" enable row level security;

drop policy if exists "Equipe le os avisos" on public."clinic+b2b_admin_events";
create policy "Equipe le os avisos"
  on public."clinic+b2b_admin_events" for select to authenticated
  using (public.clinic_b2b_is_internal_staff());

-- Ninguém escreve por fora: quem insere são os gatilhos, que são
-- `security definer`. Sem policy de insert, `authenticated` não consegue — e é
-- o que se quer, senão um aviso poderia ser forjado pelo navegador.

-- ---------------------------------------------------------------------------
-- 2. Quem já viu o quê
-- ---------------------------------------------------------------------------

create table if not exists public."clinic+b2b_admin_event_reads" (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public."clinic+b2b_admin_events"(id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (admin_user_id, event_id)
);

alter table public."clinic+b2b_admin_event_reads" enable row level security;

-- Cada um só enxerga e só escreve a própria leitura. Sem o `with check`, um
-- admin poderia marcar como lido em nome de outro — e o sino do colega apagaria
-- sozinho, que é o tipo de bug que ninguém consegue reproduzir.
drop policy if exists "Cada admin gerencia a propria leitura" on public."clinic+b2b_admin_event_reads";
create policy "Cada admin gerencia a propria leitura"
  on public."clinic+b2b_admin_event_reads" for all to authenticated
  using (admin_user_id = auth.uid())
  with check (admin_user_id = auth.uid() and public.clinic_b2b_is_internal_staff());

-- ---------------------------------------------------------------------------
-- 3. Quem quer ser avisado de quê
-- ---------------------------------------------------------------------------

create table if not exists public."clinic+b2b_admin_notification_prefs" (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  ativo boolean not null,
  updated_at timestamptz not null default now(),
  primary key (admin_user_id, tipo)
);

alter table public."clinic+b2b_admin_notification_prefs" enable row level security;

drop policy if exists "Cada admin gerencia as proprias preferencias" on public."clinic+b2b_admin_notification_prefs";
create policy "Cada admin gerencia as proprias preferencias"
  on public."clinic+b2b_admin_notification_prefs" for all to authenticated
  using (admin_user_id = auth.uid())
  with check (admin_user_id = auth.uid() and public.clinic_b2b_is_internal_staff());

-- ---------------------------------------------------------------------------
-- O registrador
-- ---------------------------------------------------------------------------
--
-- Uma função só, chamada por todos os gatilhos. O alternativa era repetir o
-- `insert` em cada um — seis lugares para mudar quando a tabela mudar, e seis
-- chances de um deles ficar para trás.
create or replace function public.registrar_aviso_do_painel(
  p_tipo text,
  p_titulo text,
  p_descricao text default null,
  p_secao text default null,
  p_referencia uuid default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public."clinic+b2b_admin_events" (tipo, titulo, descricao, secao, referencia_id)
  values (p_tipo, p_titulo, p_descricao, p_secao, p_referencia);
$$;

-- ---------------------------------------------------------------------------
-- Os gatilhos
-- ---------------------------------------------------------------------------

create or replace function public.aviso_de_pedido_novo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.registrar_aviso_do_painel(
    'pedido_novo',
    'Novo pedido de ' || coalesce(nullif(trim(new.customer_company), ''), nullif(trim(new.customer_name), ''), 'cliente'),
    coalesce(new.total_items, 0)::text || ' itens',
    'pedidos',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists aviso_de_pedido_novo on public."clinic+b2b_orders";
create trigger aviso_de_pedido_novo
  after insert on public."clinic+b2b_orders"
  for each row execute function public.aviso_de_pedido_novo();

-- Cliente e funcionário saem da mesma tabela e são avisos diferentes: quem cuida
-- de funcionário raramente é quem cuida de cliente, e juntar os dois obrigaria a
-- pessoa a desligar os dois ou aguentar os dois.
create or replace function public.aviso_de_cadastro_novo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eh_funcionario boolean := lower(coalesce(new.customer_type, '')) = 'funcionario';
begin
  perform public.registrar_aviso_do_painel(
    case when eh_funcionario then 'funcionario_novo' else 'cliente_novo' end,
    case when eh_funcionario then 'Novo funcionário: ' else 'Novo cliente: ' end
      || coalesce(nullif(trim(new.name), ''), nullif(trim(new.company), ''), 'sem nome'),
    nullif(trim(new.company), ''),
    case when eh_funcionario then 'funcionarios' else 'clientes' end,
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists aviso_de_cadastro_novo on public."clinic+b2b_customer_profiles";
create trigger aviso_de_cadastro_novo
  after insert on public."clinic+b2b_customer_profiles"
  for each row execute function public.aviso_de_cadastro_novo();

-- Só mensagem **do cliente**. A nossa própria resposta gerando aviso faria o
-- sino tocar para a equipe toda cada vez que um atendente digitasse algo.
create or replace function public.aviso_de_mensagem_nova()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quem text;
begin
  if new.sender_role <> 'customer' then
    return new;
  end if;

  select coalesce(nullif(trim(c.customer_name), ''), nullif(trim(c.customer_company), ''), 'Cliente')
    into quem
    from public."clinic+b2b_support_conversations" c
   where c.id = new.conversation_id;

  perform public.registrar_aviso_do_painel(
    'mensagem_nova',
    'Nova mensagem de ' || coalesce(quem, 'cliente'),
    left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 120),
    'mensagens',
    new.conversation_id
  );
  return new;
end;
$$;

drop trigger if exists aviso_de_mensagem_nova on public."clinic+b2b_support_messages";
create trigger aviso_de_mensagem_nova
  after insert on public."clinic+b2b_support_messages"
  for each row execute function public.aviso_de_mensagem_nova();

create or replace function public.aviso_de_banner_novo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.registrar_aviso_do_painel(
    -- `label`, e não `title`: a coluna do banner se chama assim.
    'banner_novo', 'Novo banner publicado', nullif(trim(new.label), ''), 'banners', new.id
  );
  return new;
end;
$$;

drop trigger if exists aviso_de_banner_novo on public."clinic+b2b_catalog_banners";
create trigger aviso_de_banner_novo
  after insert on public."clinic+b2b_catalog_banners"
  for each row execute function public.aviso_de_banner_novo();

create or replace function public.aviso_de_avaliacao_nova()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.registrar_aviso_do_painel(
    'avaliacao_nova',
    'Nova avaliação de produto',
    coalesce(new.rating::text || ' estrelas', null),
    'produtos',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists aviso_de_avaliacao_nova on public."clinic+b2b_product_reviews";
create trigger aviso_de_avaliacao_nova
  after insert on public."clinic+b2b_product_reviews"
  for each row execute function public.aviso_de_avaliacao_nova();

create or replace function public.aviso_de_admin_novo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.registrar_aviso_do_painel(
    'admin_novo',
    'Novo usuário do painel',
    nullif(trim(new.display_name), ''),
    'usuarios',
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists aviso_de_admin_novo on public."clinic+b2b_admin_users";
create trigger aviso_de_admin_novo
  after insert on public."clinic+b2b_admin_users"
  for each row execute function public.aviso_de_admin_novo();

comment on table public."clinic+b2b_admin_events" is
  'Avisos do painel. Alimentada por gatilhos, nunca pelo navegador. Leitura e preferência são por administrador — ver as duas tabelas irmãs.';
