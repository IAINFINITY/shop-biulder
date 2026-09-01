-- Conserta os nomes que a migration anterior deixou passar.
--
-- ## O que deu errado na 20260831130000
--
-- Duas coisas, as duas de ordem:
--
-- 1. O `update` dos nomes rodava **antes** do `insert` das tabelas que só
--    existiam em `customer_price_overrides`. A 8744 e a 8745 ainda não estavam
--    em `price_tables` quando o update passou, então não casaram com nada — e
--    logo depois o insert as criou com o nome genérico "Tabela 8744".
--
-- 2. A 52 não estava na lista escrita à mão e continuou "Tabela Proxis #52".
--
-- A lição das duas é a mesma: renomear por lista fixa erra por omissão. Aqui a
-- limpeza do nome do ERP é uma varredura — pega qualquer linha que tenha
-- "Proxis" no nome, inclusive as que aparecerem depois.

-- As que têm nome de verdade, vindo da tela de importação do ERP antes de ele
-- sair do ar. Agora elas já existem, porque o insert da migration anterior rodou.
update public."clinic+b2b_price_tables" set name = 'Rio de Janeiro 2026' where tpr_id = 8744;
update public."clinic+b2b_price_tables" set name = 'Representante Negociação Especial 2026' where tpr_id = 8745;

-- A varredura: qualquer nome que ainda carregue o sistema antigo vira um rótulo
-- neutro. "Tabela Proxis #52" não diz nada a quem usa o painel — o número diz o
-- mesmo, sem o nome de um sistema que não existe mais.
update public."clinic+b2b_price_tables"
   set name = 'Tabela ' || tpr_id
 where name ilike '%proxis%'
    or name ilike '%proxsys%';

comment on table public."clinic+b2b_price_tables" is
  'Tabelas de preço da plataforma. Os números vêm do ERP antigo e não podem ser renumerados: o TXT do FOCCO os grava no campo tabVenda.';
