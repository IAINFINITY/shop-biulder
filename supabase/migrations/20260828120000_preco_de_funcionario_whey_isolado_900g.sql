-- Corrige o preço de funcionário do WHEY MAIS ISOLADO 900g.
--
-- ## O que estava errado
--
-- A planilha `TABELA CLINIC 2026 Funcionários_COD_FOCCO_8730.xlsx` traz dois
-- códigos para o isolado neutro:
--
--   7178 · WHEY MAIS ISOLADO sabor neutro **900g** · R$ 299,89
--   7179 · WHEY MAIS ISOLADO sabor neutro **400g** · R$ 137,76
--
-- O catálogo do site usa outra numeração para o mesmo produto:
--
--   7179 · WHEY MAIS ISOLADO 900g - Sabor Neutro · R$ 339,61 de tabela cheia
--
-- Ou seja: **o código 7179 significa produtos diferentes nos dois sistemas.** No
-- ERP/planilha é o pote de 400g; no catálogo é o de 900g. E não existe nenhum
-- produto 7178 no catálogo — o 400g simplesmente não é vendido no site.
--
-- A migration `20260825120000` copiou a planilha corretamente, código por
-- código, e por isso o erro passou: os 160 preços conferem com a origem. O que
-- não confere é a *identidade* do 7179 entre os dois cadastros. O resultado é que
-- o funcionário comprava o pote de 900g pagando o preço do de 400g.
--
-- ## Como se sabe que é este o erro, e não o contrário
--
-- Toda a família de proteína tem a mesma relação entre tabela cheia e preço de
-- funcionário — 1,13, sem exceção em 10 itens:
--
--   6273 1,119 · 7513 1,119 · 5840 1,119 · 6947 1,132 · 6946 1,132
--   6945 1,132 · 6980 1,132 · 6981 1,132 · 6979 1,133 · 5844 1,132
--
--   7179 → 339,61 / 137,76 = **2,465**   (o dobro do resto)
--   7179 → 339,61 / 299,89 = **1,132**   (exatamente a família)
--
-- Não é estimativa: 299,89 é o valor que a própria planilha dá ao 900g, e é o
-- único que devolve o 7179 para o padrão dos irmãos.
--
-- ## Impacto
--
-- R$ 162,13 por unidade vendida, sempre a favor do comprador. Vale desde
-- 25/08/2026, quando a tabela de funcionário entrou no ar.

update public."clinic+b2b_customer_price_overrides"
   set price = 299.89
 where customer_type = 'funcionario'
   and proxis_tpr_id is null
   and product_code = '7179';

-- Registro de que o 400g da planilha ficou sem destino: não há produto no
-- catálogo para ele, e inventar um código seria pior. Se o 400g passar a ser
-- vendido no site, o preço de funcionário dele é R$ 137,76 — o valor que estava,
-- por engano, no 900g.

comment on table public."clinic+b2b_customer_price_overrides" is
  'Preços por tipo de cliente e por tabela do Proxis. Atenção: os códigos da planilha de funcionário são FOCCO e nem sempre coincidem com product_code do catálogo — o caso 7178/7179 (whey isolado) está descrito na migration 20260828120000.';
