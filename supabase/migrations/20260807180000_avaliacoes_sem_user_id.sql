-- Tira o `user_id` do que o visitante anônimo consegue ler nas avaliações.
--
-- Sondagem anônima com a chave publicável devolvia a tabela de avaliações com a
-- coluna `user_id`. Não é credencial, mas é identificador estável: permite
-- juntar todas as avaliações da mesma pessoa e cruzar com qualquer outro lugar
-- onde o mesmo id apareça. A §24 do padrão de autenticação pede minimização no
-- que é exposto.
--
-- ## Por que revogar a coluna, e não mexer na política
--
-- Policy de RLS decide **linha**, não coluna — não há como uma política dizer
-- "esta linha sim, mas sem este campo". Privilégio por coluna é o mecanismo do
-- Postgres para isso.
--
-- ## Por que só `anon`
--
-- `authenticated` continua enxergando: a tela de avaliações precisa saber qual
-- review é da própria pessoa para oferecer editar e apagar. O que se fecha é o
-- acesso de quem nem conta tem.

revoke select (user_id) on table "clinic+b2b_product_reviews" from anon;

comment on column "clinic+b2b_product_reviews".user_id is
  'Autor da avaliação. SELECT revogado de anon (§24, minimização): a leitura pública passa por get_product_reviews.';
