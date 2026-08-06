-- Integridade do atendimento: conversa orfa e mensagem orfa.
--
-- Sintoma: o painel do admin mostrava duas conversas para o mesmo CNPJ, uma com
-- o nome da pessoa e outra com o nome da empresa. Nao eram duas pessoas — uma
-- delas apontava para um usuario que **nao existe mais** em `auth.users`.
--
-- Causa: nenhuma das duas tabelas de suporte tinha chave estrangeira. Apagar um
-- usuario deixava a conversa dele para tras, e apagar uma conversa deixaria as
-- mensagens. A conversa guarda uma copia dos dados do cliente (nome, CNPJ,
-- telefone), entao a linha orfa continuava parecendo um cliente de verdade.

-- 1. Limpa o que ja ficou para tras.
--
-- Vem antes das constraints porque elas falhariam com as linhas orfas presentes.
delete from public."clinic+b2b_support_messages"
where conversation_id not in (select id from public."clinic+b2b_support_conversations");

delete from public."clinic+b2b_support_conversations"
where customer_user_id not in (select id from auth.users);

-- 2. Conversa morre com o usuario.
alter table public."clinic+b2b_support_conversations"
  drop constraint if exists clinic_b2b_support_conversations_customer_user_fk;

alter table public."clinic+b2b_support_conversations"
  add constraint clinic_b2b_support_conversations_customer_user_fk
  foreign key (customer_user_id) references auth.users (id) on delete cascade;

-- 3. Mensagem morre com a conversa.
alter table public."clinic+b2b_support_messages"
  drop constraint if exists clinic_b2b_support_messages_conversation_fk;

alter table public."clinic+b2b_support_messages"
  add constraint clinic_b2b_support_messages_conversation_fk
  foreign key (conversation_id) references public."clinic+b2b_support_conversations" (id)
  on delete cascade;

-- `sender_user_id` fica **sem** chave estrangeira, de proposito.
--
-- O caminho natural seria `on delete set null`, mas a coluna e `not null` e
-- torna-la anulavel para isso trocaria um problema por outro: todo codigo que le
-- o remetente passaria a precisar tratar nulo.
--
-- Na pratica o caso ja esta coberto: se quem escreveu foi o cliente, a conversa
-- inteira cai junto com ele pela cascata acima. Sobra o caso de um admin apagado
-- — e ai manter a mensagem com o id antigo e melhor que perder a resposta que o
-- cliente recebeu. O nome do autor e resolvido na leitura e cai para nulo
-- sozinho quando o usuario nao existe mais.
