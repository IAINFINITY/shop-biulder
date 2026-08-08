-- Corrige a migration 20260807180000: o `revoke select (user_id)` nao teve efeito.
--
-- ## Por que a primeira nao funcionou
--
-- `anon` tem SELECT no **nivel de tabela**, e no Postgres um grant de tabela
-- cobre todas as colunas — inclusive as que vierem a existir depois. Um
-- `revoke select (coluna)` nao subtrai de um grant de tabela: os dois vivem em
-- planos diferentes, e o de tabela vence. O comando roda sem erro e sem efeito,
-- que e o pior tipo de comando.
--
-- Conferido depois de aplicar:
--   has_column_privilege('anon', ..., 'user_id', 'select')  ->  true
--   quem tem SELECT no nivel de tabela: anon, authenticated, postgres, service_role
--
-- ## A forma que funciona
--
-- Derrubar o grant de tabela e reconceder **coluna a coluna**, menos `user_id`.
-- A partir dai o privilegio de `anon` passa a existir so no nivel de coluna, onde
-- a ausencia de `user_id` significa alguma coisa.
--
-- ## Por que a leitura publica continua de pe
--
-- `get_product_reviews` e `count_product_reviews` sao `security definer`
-- (verificado em `pg_proc.prosecdef`), entao rodam com o privilegio do dono e nao
-- com o de quem chama. E por ali que a pagina do produto le as avaliacoes.
--
-- ## Efeito colateral aceito
--
-- Coluna nova criada no futuro **nao** sera legivel por `anon` ate ser concedida
-- aqui. E o comportamento certo por padrao: coluna nova nasce fechada, e quem a
-- adicionar decide se ela e publica.

revoke select on table "clinic+b2b_product_reviews" from anon;

grant select (
  id,
  product_id,
  rating,
  title,
  comment,
  created_at,
  updated_at,
  tags,
  admin_response,
  admin_responded_at
) on table "clinic+b2b_product_reviews" to anon;

comment on column "clinic+b2b_product_reviews".user_id is
  'Autor da avaliação. SELECT não concedido a anon (§24, minimização): a leitura pública passa por get_product_reviews, que é security definer.';
