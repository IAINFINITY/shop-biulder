-- A equipe começar a conversa, e o cliente ficar sabendo.
--
-- ## O que faltava
--
-- A conversa só nascia de um lado: o cliente entrava na seção Mensagens e ela
-- aparecia. Não havia como puxar assunto — avisar que um pedido travou, cobrar
-- um cadastro incompleto, responder por escrito o que foi combinado no
-- telefone. Quem atende resolvia isso pelo WhatsApp pessoal, fora da
-- plataforma, onde ninguém mais da equipe vê.
--
-- ## O aviso é só para a conversa que **nós** abrimos
--
-- Toda resposta nossa gerando notificação encheria a sineta do cliente que está
-- com o chat aberto conversando conosco. O gatilho só dispara quando a mensagem
-- do admin é a **primeira da conversa** — que é exatamente "abrimos um chamado
-- com você", a hora em que o cliente não tem como saber sozinho.
--
-- A consequência aceita: se a equipe abre e manda duas mensagens seguidas sem
-- resposta, o aviso sai uma vez. É o que se quer — um chamado, um aviso.

-- A equipe precisa poder criar a conversa. Até aqui só a policy do próprio
-- cliente existia, então um insert vindo do painel era recusado pela RLS.
drop policy if exists "Equipe abre conversa com o cliente" on public."clinic+b2b_support_conversations";
create policy "Equipe abre conversa com o cliente"
  on public."clinic+b2b_support_conversations" for insert to authenticated
  with check (public.clinic_b2b_is_internal_staff());

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

  -- Primeira mensagem da conversa? `id <> new.id` porque o gatilho é `after
  -- insert`: a própria linha já está lá, e sem isso a resposta seria sempre
  -- "não, já existe uma mensagem" — a dela mesma.
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
    (title, summary, body, cta_label, cta_url, target_user_id, active, priority, ends_at)
  values (
    'Nossa equipe te enviou uma mensagem',
    'Você tem uma mensagem nova no chat de atendimento.',
    left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 300),
    'Responder no chat',
    '/conta?section=mensagens',
    destinatario,
    true,
    -- Acima do aviso de atendimento encerrado: uma pergunta nossa esperando
    -- resposta vale mais que o registro de algo que já terminou.
    1,
    now() + interval '30 days'
  );

  return new;
end;
$$;

drop trigger if exists avisar_conversa_aberta_pela_equipe on public."clinic+b2b_support_messages";
create trigger avisar_conversa_aberta_pela_equipe
  after insert on public."clinic+b2b_support_messages"
  for each row execute function public.avisar_conversa_aberta_pela_equipe();
