-- "Marcar como lido" nunca funcionou.
--
-- ## O sintoma
--
-- "quando eu clico na notificação e clico em 'Marcado como lido' não funciona.
-- A notificação fica infinito ainda."
--
-- ## A causa
--
-- `useCatalogNotificationReads` grava assim:
--
--   .upsert(payload, { onConflict: "user_id,notification_id" })
--
-- `ON CONFLICT` sobre um par de colunas exige um índice único **sobre esse
-- par**. A tabela só tinha a chave primária em `id`, então o Postgres recusa a
-- instrução inteira com "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification".
--
-- Ou seja: toda tentativa de marcar como lido falhava, desde sempre. Conferido
-- em 01/09/2026 — **zero linhas** na tabela, num sistema com avisos há semanas.
--
-- ## ⚠️ O erro não aparecia na tela
--
-- A chamada é `void markAsRead(item.id).catch(() => null)`. O `.catch` engolia
-- a falha para o clique não virar um alerta vermelho — e engoliu também a única
-- pista de que nada estava sendo gravado. O `catch` mudo continua fazendo
-- sentido para falha de rede; o que faltava era a restrição existir.
--
-- ## A restrição também é a regra
--
-- Sem ela, nada impedia duas linhas dizendo que a mesma pessoa leu o mesmo
-- aviso. A contagem de não-lidos usa um `Set`, então não quebraria — mas a
-- tabela cresceria uma linha por clique, para sempre.

-- Não há duplicatas a limpar (a tabela está vazia), mas a limpeza fica escrita:
-- se esta migration rodar num banco onde alguém gravou por outro caminho, ela
-- precisa passar em vez de estourar no índice.
delete from public."clinic+b2b_catalog_notification_reads" a
 using public."clinic+b2b_catalog_notification_reads" b
 where a.user_id = b.user_id
   and a.notification_id = b.notification_id
   and a.ctid > b.ctid;

create unique index if not exists idx_leitura_unica_por_aviso
  on public."clinic+b2b_catalog_notification_reads" (user_id, notification_id);
