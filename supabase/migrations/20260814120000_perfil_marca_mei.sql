-- Saber quem é MEI, sem adivinhar pelo nome.
--
-- ## Por que uma coluna, e não uma regra de texto
--
-- Empresário Individual não escolhe razão social: a Receita monta uma colando a
-- raiz do CNPJ na frente do nome da pessoa. É o que se vê no cadastro:
--
--     26.041.551 PATRICIA GUEDES MAZUI PIASSUM
--     54.626.438 MARCIO DIAS
--     66.121.553 JOSE FRANCISCO DE ARAUJO NETO
--
-- A tentação é marcar esse padrão como "MEI" e resolver sem tocar no banco.
-- **Não funciona.** Consultando a Receita nos três casos acima, dois são MEI e
-- um não é — todos com o mesmo formato de nome. Todo MEI é Empresário
-- Individual, mas nem todo Empresário Individual é MEI.
--
-- Marcar os três colocaria um rótulo errado na tela de um cliente real, com o
-- nome dele do lado. Por isso o selo sai de um dado, não de uma aparência.
--
-- ## Os três estados
--
-- `null` não é o mesmo que `false`, e a diferença aparece na tela:
--
--   null   ainda não consultamos a Receita para este CNPJ — nenhum selo
--   true   é MEI                                          — selo "MEI"
--   false  consultamos, e não é                           — nenhum selo
--
-- Com um booleano não nulo, quem nunca foi consultado apareceria como "não é
-- MEI" — uma afirmação que não temos como sustentar. O preenchimento acontece
-- junto com o endereço da empresa, no primeiro acesso de cada conta (ver
-- `enderecoDaReceita.ts`).

alter table "clinic+b2b_customer_profiles"
  add column if not exists is_mei boolean;

comment on column "clinic+b2b_customer_profiles".is_mei is
  'Optante pelo MEI, conforme a Receita. NULL = ainda não consultado — não confundir com false, que significa "consultado e não é".';
