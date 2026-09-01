-- Que tipo de aviso é este.
--
-- ## Por que uma coluna, e não adivinhar pelo título
--
-- A tela precisa de um ícone por tipo — pedido recebido, em andamento,
-- aguardando pagamento, enviado, concluído, cancelado, atendimento. Sem uma
-- coluna, o jeito seria ler o título com `includes("enviado")`, que é o mesmo
-- erro que `normalizarStatusDoPedido` já teve: "aguardando retirada" casava com
-- "aguardando" e virava "aguardando pagamento".
--
-- Título é texto para humano; ele muda quando alguém melhora a frase, e aí o
-- ícone muda junto sem ninguém pedir. A coluna é escrita por quem sabe o que
-- aconteceu — o gatilho — e não muda quando a redação muda.
--
-- `campanha` como padrão: é o que as notificações existentes são, e o que
-- alguém cria à mão pelo painel.

alter table public."clinic+b2b_catalog_notifications"
  add column if not exists tipo text not null default 'campanha';

comment on column public."clinic+b2b_catalog_notifications".tipo is
  'campanha | pedido_recebido | pedido_em_andamento | pedido_aguardando_pagamento | pedido_enviado | pedido_concluido | pedido_cancelado | atendimento_aberto | atendimento_encerrado';

-- ---------------------------------------------------------------------------
-- Os gatilhos passam a dizer o tipo
-- ---------------------------------------------------------------------------

create or replace function public.avisar_cliente_do_estado_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destinatario uuid;
  titulo text;
  corpo text;
  categoria text;
  estado text := lower(coalesce(new.status, ''));
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select p.user_id into destinatario
    from public."clinic+b2b_customer_profiles" p
   where p.cnpj = new.customer_cnpj
   limit 1;

  if destinatario is null then
    return new;
  end if;

  -- ⚠️ Mesma ordem de casamento de `statusDoPedido.ts`: `cancel` primeiro, e
  -- `pagament` sozinho — nunca `aguardando` solto, que pega "aguardando
  -- retirada".
  if estado like '%cancel%' then
    categoria := 'pedido_cancelado';
    titulo := 'Seu pedido foi cancelado';
    corpo := 'Seu pedido foi cancelado. Se não foi você quem pediu isso, fale com a gente pelo chat.';
  elsif estado like '%pagament%' then
    categoria := 'pedido_aguardando_pagamento';
    titulo := 'Seu pedido aguarda pagamento';
    corpo := 'Seu pedido está pronto e aguarda o pagamento. Nosso time entra em contato para combinar a forma e as condições — o pagamento não é feito pelo site.';
  elsif estado like '%enviad%' or estado like '%despach%' then
    categoria := 'pedido_enviado';
    titulo := 'Seu pedido foi enviado';
    corpo := 'Seu pedido saiu para entrega. Em breve você recebe.';
  elsif estado like '%conclu%' or estado like '%entreg%' or estado like '%atendid%' then
    categoria := 'pedido_concluido';
    titulo := 'Seu pedido foi concluído';
    corpo := 'Seu pedido foi concluído. Obrigado pela compra!';
  elsif estado like '%andamento%' or estado like '%process%' then
    categoria := 'pedido_em_andamento';
    titulo := 'Seu pedido está em andamento';
    corpo := 'Nosso time já está preparando o seu pedido.';
  else
    categoria := 'pedido_recebido';
    titulo := 'Recebemos o seu pedido';
    corpo := 'Recebemos seu pedido. Nosso time vai conferir os itens e entrar em contato.';
  end if;

  insert into public."clinic+b2b_catalog_notifications"
    (title, summary, body, cta_label, cta_url, target_user_id, active, priority, ends_at, tipo)
  values (
    titulo, 'Atualização do seu pedido.', corpo,
    'Ver meus pedidos', '/conta?section=pedidos',
    destinatario, true, 2, now() + interval '60 days', categoria
  );

  return new;
end;
$$;

create or replace function public.avisar_atendimento_encerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finalizada_em is null or new.finalizada_em is not distinct from old.finalizada_em then
    return new;
  end if;

  if new.customer_user_id is null then
    return new;
  end if;

  insert into public."clinic+b2b_catalog_notifications"
    (title, summary, body, cta_label, cta_url, target_user_id, active, priority, ends_at, tipo)
  values (
    'Atendimento finalizado',
    'Encerramos o seu atendimento no chat.',
    'Seu atendimento foi concluído pela nossa equipe. Se precisar de mais alguma coisa, é só responder no chat que a conversa reabre e continuamos de onde paramos.',
    'Abrir o chat', '/conta?section=mensagens',
    new.customer_user_id, true, 0, now() + interval '30 days', 'atendimento_encerrado'
  );

  return new;
end;
$$;

create or replace function public.avisar_conversa_aberta_pela_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destinatario uuid;
begin
  if new.sender_role <> 'admin' then
    return new;
  end if;

  if exists (
    select 1 from public."clinic+b2b_support_messages" m
     where m.conversation_id = new.conversation_id and m.id <> new.id
  ) then
    return new;
  end if;

  select c.customer_user_id into destinatario
    from public."clinic+b2b_support_conversations" c
   where c.id = new.conversation_id;

  if destinatario is null then
    return new;
  end if;

  insert into public."clinic+b2b_catalog_notifications"
    (title, summary, body, cta_label, cta_url, target_user_id, active, priority, ends_at, tipo)
  values (
    'Nossa equipe te enviou uma mensagem',
    'Você tem uma mensagem nova no chat de atendimento.',
    left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 300),
    'Responder no chat', '/conta?section=mensagens',
    destinatario, true, 1, now() + interval '30 days', 'atendimento_aberto'
  );

  return new;
end;
$$;

-- Os avisos de pedido que já existem ganham o tipo pelo título — é a única
-- pista disponível para o que já foi gravado, e vale só para esta correção
-- única, não como regra.
update public."clinic+b2b_catalog_notifications"
   set tipo = case
     when title ilike '%cancelad%' then 'pedido_cancelado'
     when title ilike '%aguarda pagamento%' then 'pedido_aguardando_pagamento'
     when title ilike '%enviado%' then 'pedido_enviado'
     when title ilike '%concluído%' or title ilike '%concluido%' then 'pedido_concluido'
     when title ilike '%em andamento%' then 'pedido_em_andamento'
     when title ilike '%Recebemos o seu pedido%' then 'pedido_recebido'
     when title ilike '%Atendimento finalizado%' then 'atendimento_encerrado'
     when title ilike '%equipe te enviou%' then 'atendimento_aberto'
     else 'campanha'
   end
 where tipo = 'campanha';
