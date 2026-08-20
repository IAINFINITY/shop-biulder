-- Esconder uma categoria da loja sem mexer nos produtos dela.
--
-- ## O que o time de design pediu, e por que não funcionava
--
-- "Conseguimos remover as categorias sem precisar tirar os produtos delas?"
--
-- Eles apagavam a categoria no painel e ela continuava na loja. Não é bug de
-- salvamento: **a vitrine nunca leu esta tabela**. A lista de categorias do
-- catálogo é montada a partir do campo `type` de cada produto (ver
-- `Index.tsx`), então enquanto houver um produto com aquele texto, a categoria
-- reaparece.
--
-- O painel até avisa — "isso apenas tira a opção do seletor. Produtos já
-- cadastrados continuam com o tipo salvo" — mas quem quer sumir com a
-- categoria da loja lê isso e conclui que apagar resolve.
--
-- ## Por que uma coluna, e não passar a filtrar pela tabela
--
-- A saída óbvia seria a vitrine mostrar só o que está registrado aqui. Ela tem
-- dois modos de falha ruins:
--
-- 1. Produto com tipo que ninguém cadastrou some do filtro, sem aviso. Hoje há
--    zero desses, mas basta alguém digitar um tipo novo no produto.
-- 2. Se a leitura desta tabela falhar, a loja fica **sem categoria nenhuma**.
--
-- Com uma marca de ocultar, o registro só consegue **esconder**. Silêncio não é
-- decisão: categoria não registrada continua aparecendo, e falha de leitura
-- mantém exatamente o comportamento de hoje.
--
-- ## O que não muda
--
-- Apagar a categoria continua significando o que o painel já diz: sai do
-- seletor de cadastro. Os produtos nunca são tocados por nenhum dos dois
-- caminhos, e links diretos (`?categoria=Whey`, usado inclusive por banner)
-- continuam funcionando mesmo para categoria oculta.

alter table "clinic+b2b_product_types"
  add column if not exists visivel boolean not null default true;

comment on column "clinic+b2b_product_types".visivel is
  'false esconde a categoria dos filtros da loja. Não afeta os produtos, nem links diretos por ?categoria=.';
