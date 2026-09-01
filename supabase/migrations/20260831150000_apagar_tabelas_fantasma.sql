-- Apaga as tabelas de preço que não servem a ninguém.
--
-- ## Quais, e por quê
--
-- | tpr | nome | preços | contas |
-- |-----|------|--------|--------|
-- | 40  | Tabela padrão (catálogo)           | 0   | 0 |
-- | 41  | Tabela alternativa (catálogo -15%) | 0   | 0 |
-- | 52  | Tabela 52                          | 0   | 0 |
-- | 8744| Rio de Janeiro 2026                | 148 | 0 |
-- | 8745| Representante Negociação Especial   | 149 | 0 |
--
-- As três primeiras são restos de teste de junho e julho: nenhum preço, nenhuma
-- conta, nome de rascunho. Não há nada a perder.
--
-- As duas últimas têm preço de verdade, mas **nenhuma conta compra por elas**.
-- Vinham do ERP e ficaram órfãs quando ninguém foi atribuído a elas. A tela
-- escondia as cinco e explicava a ausência num rodapé — trocar um ruído por uma
-- nota de rodapé continua sendo ruído.
--
-- ## Os 297 preços não se perdem
--
-- Estão em `documentation/backups/precos-8744-8745-31-08-2026.sql`, prontos para
-- rodar de volta se o Rio de Janeiro ou a Negociação Especial voltarem a ter
-- cliente. O arquivo recria a tabela e os preços com os mesmos números.
--
-- Isto é registro deliberado, não excesso de zelo: apagar preço comercial sem
-- caminho de volta é o tipo de coisa que só se descobre errada meses depois,
-- quando alguém pergunta "quanto era o Rio de Janeiro?".
--
-- ## O que NÃO é apagado
--
-- A 80 e a 82 ficam. Elas também não têm preço nenhum, mas **têm três clientes**
-- — que hoje pagam o preço de catálogo sem que nada diga isso. São um problema a
-- resolver, não um fantasma a varrer: sumir com elas esconderia os três.

delete from public."clinic+b2b_customer_price_overrides"
 where proxis_tpr_id in (8744, 8745);

delete from public."clinic+b2b_price_tables"
 where tpr_id in (40, 41, 52, 8744, 8745);
