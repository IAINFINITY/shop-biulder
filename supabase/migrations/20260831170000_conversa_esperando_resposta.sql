-- Saber quais conversas estão esperando resposta nossa.
--
-- ## O problema relatado
--
-- "eu tô vendo aqui um cliente que mandou mensagem pro pessoal, mas ninguém é
-- notificado sobre isso dentro da plataforma."
--
-- É verdade: hoje não há nada. Nem coluna de lido, nem contagem, nem aviso. As
-- 8 conversas existentes têm 13 mensagens, 8 delas do cliente — e não há como
-- saber, sem abrir uma por uma, quais ficaram sem resposta.
--
-- ## Por que NÃO é "lido/não lido"
--
-- Foi o primeiro desenho e ele tem um defeito conhecido em caixa compartilhada:
-- se um atendente abre a conversa, ela fica lida **para todo mundo**, e o sinal
-- que dizia "isto ainda precisa de trabalho" desaparece porque alguém passou o
-- olho. A recomendação corrente para caixa de equipe é justamente parar de
-- depender de lido/não lido e usar estado objetivo.
--
-- O sinal que importa aqui é outro e não se apaga por engano:
--
--   **a última mensagem é do cliente** → ninguém respondeu ainda.
--
-- Vale para qualquer atendente, não depende de quem abriu o quê, e responde a
-- pergunta real ("quem está esperando?") em vez da pergunta parecida ("o que eu
-- ainda não vi?").
--
-- É o mesmo recorte que o CRM de referência chama de "Esperando", e lá está
-- documentado que ele é diferente de "paradas" — cliente que sumiu depois da
-- nossa resposta. As duas pedem ações opostas: uma pede resposta, a outra pede
-- um cutucão.
--
-- ## Coluna, e não consulta
--
-- Dava para derivar isto com um `order by created_at desc limit 1` por conversa.
-- Com 8 conversas não faz diferença; com 800 a lista do painel passaria a fazer
-- uma subconsulta por linha, e o contador da barra lateral roda em toda troca de
-- tela. A coluna é escrita pelo mesmo gatilho que já mantém o resumo — custo
-- zero a mais.

alter table public."clinic+b2b_support_conversations"
  add column if not exists ultima_mensagem_de text;

comment on column public."clinic+b2b_support_conversations".ultima_mensagem_de is
  'customer ou admin. Quando é customer, a conversa está esperando resposta nossa.';

-- O gatilho que já existe passa a gravar mais esta coluna.
create or replace function public.support_messages_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."clinic+b2b_support_conversations"
  set
    last_message_at = new.created_at,
    last_message_preview = left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 140),
    -- Quem falou por último. É daqui que sai "esperando resposta".
    ultima_mensagem_de = new.sender_role,
    assigned_admin_id = case
      when new.sender_role = 'admin' and assigned_admin_id is null then new.sender_user_id
      else assigned_admin_id
    end,
    updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

-- As 8 conversas que já existem ganham o valor a partir da última mensagem real.
--
-- Sem isto todas nasceriam nulas e o painel abriria dizendo que ninguém está
-- esperando — justamente no dia em que a funcionalidade existe para dizer o
-- contrário.
update public."clinic+b2b_support_conversations" c
   set ultima_mensagem_de = m.sender_role
  from (
    select distinct on (conversation_id) conversation_id, sender_role
      from public."clinic+b2b_support_messages"
     order by conversation_id, created_at desc
  ) m
 where m.conversation_id = c.id
   and c.ultima_mensagem_de is distinct from m.sender_role;

-- O índice serve à pergunta que a barra lateral faz a cada troca de tela:
-- "quantas conversas abertas estão esperando resposta?"
create index if not exists idx_conversas_esperando
  on public."clinic+b2b_support_conversations" (status, ultima_mensagem_de)
  where status = 'open';
