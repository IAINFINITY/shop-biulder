-- Limpar a lista de avisos — no painel e na conta do cliente.
--
-- ## Por que não é um DELETE
--
-- O impulso é apagar a linha do aviso. Não dá: `clinic+b2b_admin_events` é
-- **compartilhada** entre todos os administradores, e `clinic+b2b_catalog_
-- notifications` é a campanha que a loja publicou para todo mundo. Um admin
-- limpando a caixa dele apagaria o aviso de pedido novo da equipe inteira, e um
-- cliente limpando a dele apagaria a campanha de quem ainda não viu.
--
-- Então "limpar" é um estado **por pessoa**, do mesmo jeito que "li isto" já é:
-- uma coluna na tabela de leituras, que já existe e já é por pessoa.
--
-- ## Dispensar não é o mesmo que marcar como lido
--
-- Marcar como lido apaga o destaque e mantém o aviso na lista — dá para voltar e
-- reler. Dispensar tira da lista. São duas ações diferentes e a tela oferece as
-- duas, então precisam de duas colunas: reaproveitar `lida_em` faria "marcar
-- todos como lidos" esvaziar a caixa, que não é o que ninguém pediu ao clicar.
--
-- A linha continua existindo, com data. Ninguém perde nada de verdade: se um dia
-- alguém precisar entender por que um aviso sumiu da tela de uma pessoa, está
-- registrado quando ela o dispensou.

alter table public."clinic+b2b_admin_event_reads"
  add column if not exists dispensado_em timestamptz;

alter table public."clinic+b2b_catalog_notification_reads"
  add column if not exists dispensado_em timestamptz;

comment on column public."clinic+b2b_admin_event_reads".dispensado_em is
  'Quando este admin tirou o aviso da própria lista. Não afeta os outros admins.';

comment on column public."clinic+b2b_catalog_notification_reads".dispensado_em is
  'Quando este cliente tirou o aviso da própria lista. Não afeta a campanha nem os outros clientes.';

-- ⚠️ `read_at` é NOT NULL nesta tabela, e dispensar sem ler é possível: quem
-- clica em "limpar" numa lista com aviso não lido está dispensando os dois
-- estados de uma vez. Sem o padrão, o upsert de dispensa falharia na coluna
-- obrigatória — e falharia calado, como o `onConflict` sem índice falhava até
-- 01/09/2026.
alter table public."clinic+b2b_catalog_notification_reads"
  alter column read_at set default now();
