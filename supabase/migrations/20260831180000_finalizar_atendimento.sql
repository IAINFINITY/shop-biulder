-- Encerrar o atendimento — e o cliente ficar sabendo.
--
-- ## O que faltava
--
-- Não havia como encerrar. A coluna `status` aceita `closed`, mas nenhuma tela
-- escreve isso: as 8 conversas em produção estão **todas** em `open`, inclusive
-- as que acabaram há semanas. A caixa só cresce.
--
-- ## Por que uma DATA e não um booleano
--
-- Esta é a parte que parece detalhe e não é. Com `status = 'closed'`:
--
--   atendente encerra → cliente responde → a conversa **continua encerrada**
--
-- Ela some da lista com uma mensagem nova dentro, e ninguém sabe que existe
-- algo para reabrir. O cliente fica falando sozinho.
--
-- Guardando **quando** foi encerrada, a regra vira uma comparação de datas:
--
--   encerrada  ⟺  finalizada_em >= last_message_at
--
-- Uma mensagem nova é mais recente que o encerramento, então ela **reabre a
-- conversa sozinha** — sem gatilho de reabertura, sem evento para processar,
-- sem nada que possa falhar em silêncio. É o desenho do CRM que serve de
-- referência, e lá o teste que guarda isso está marcado como o coração da
-- funcionalidade.
--
-- `status` fica como está. Ele não é mais a verdade operacional; quem responde
-- "esta conversa acabou?" é a comparação acima, em `caixaDeMensagens.ts`.

alter table public."clinic+b2b_support_conversations"
  add column if not exists finalizada_em timestamptz,
  add column if not exists finalizada_por uuid references auth.users(id) on delete set null;

comment on column public."clinic+b2b_support_conversations".finalizada_em is
  'Quando o atendimento foi encerrado. Encerrada de verdade só enquanto finalizada_em >= last_message_at: mensagem nova do cliente reabre sozinha.';

-- ---------------------------------------------------------------------------
-- Avisar o cliente
-- ---------------------------------------------------------------------------
--
-- Isto não existe no CRM de referência — lá o atendimento é WhatsApp, e o fim
-- da conversa é evidente para os dois lados. Aqui o chat mora dentro do painel:
-- o cliente escreveu, fechou o navegador, e não tem por que voltar. Encerrar
-- sem avisar é encerrar só do nosso lado.
--
-- O aviso reusa `clinic+b2b_catalog_notifications` com `target_user_id`, que já
-- entrega notificação para uma conta só e já tem tela para mostrar. Uma tabela
-- nova daria o mesmo resultado com mais uma caixa de entrada para o cliente
-- aprender.
--
-- ⚠️ **Gatilho, e não o navegador.** Se a tela chamasse o insert, todo
-- encerramento feito com a aba velha, ou direto no banco, sairia sem aviso — e
-- o cliente descobriria que o atendimento acabou pelo silêncio.
create or replace function public.avisar_atendimento_encerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só na virada para encerrada, e só encerramento de verdade.
  --
  -- `is distinct from` cobre o caso de salvar a conversa por outro motivo com o
  -- mesmo `finalizada_em`: sem ele, cada update mandaria o aviso de novo.
  if new.finalizada_em is null or new.finalizada_em is not distinct from old.finalizada_em then
    return new;
  end if;

  -- Reabrir e encerrar de novo é normal, e cada encerramento merece seu aviso.
  -- Mas encerrar uma conversa de quem nunca teve conta não tem para quem ir.
  if new.customer_user_id is null then
    return new;
  end if;

  insert into public."clinic+b2b_catalog_notifications"
    (title, summary, body, cta_label, cta_url, target_user_id, active, priority, ends_at)
  values (
    'Atendimento finalizado',
    'Encerramos o seu atendimento no chat.',
    -- A última frase é o que evita o pior desfecho: o cliente achar que a porta
    -- fechou. Responder reabre — e reabre de verdade, pela regra das datas.
    'Seu atendimento foi concluído pela nossa equipe. Se precisar de mais alguma coisa, é só responder no chat que a conversa reabre e continuamos de onde paramos.',
    'Abrir o chat',
    '/conta?section=mensagens',
    new.customer_user_id,
    true,
    0,
    -- Some sozinho depois de 30 dias. Aviso de coisa resolvida que fica para
    -- sempre vira entulho, e entulho ensina a ignorar a sineta.
    now() + interval '30 days'
  );

  return new;
end;
$$;

drop trigger if exists avisar_atendimento_encerrado on public."clinic+b2b_support_conversations";
create trigger avisar_atendimento_encerrado
  after update of finalizada_em on public."clinic+b2b_support_conversations"
  for each row execute function public.avisar_atendimento_encerrado();

-- ---------------------------------------------------------------------------
-- Quem pode encerrar
-- ---------------------------------------------------------------------------
--
-- Só a equipe. O cliente reabre escrevendo — que é o gesto natural — mas não
-- encerra: encerrar é a decisão de quem atende, e um cliente que fechasse o
-- próprio atendimento sumiria da fila sem ninguém ter olhado.
drop policy if exists "Equipe encerra o atendimento" on public."clinic+b2b_support_conversations";
create policy "Equipe encerra o atendimento"
  on public."clinic+b2b_support_conversations" for update to authenticated
  using (public.clinic_b2b_is_internal_staff())
  with check (public.clinic_b2b_is_internal_staff());

-- A fila do painel pergunta por conversas em aberto. O índice parcial deixa de
-- fora justamente as encerradas, que são as que vão se acumular com o tempo.
create index if not exists idx_conversas_finalizadas
  on public."clinic+b2b_support_conversations" (finalizada_em)
  where finalizada_em is not null;
