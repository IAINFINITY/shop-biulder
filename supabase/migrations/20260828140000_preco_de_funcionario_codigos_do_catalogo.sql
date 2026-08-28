-- Preço de funcionário para os produtos que o catálogo cadastrou com outro código.
--
-- ## O problema
--
-- Os códigos da planilha `TABELA CLINIC 2026 Funcionários_COD_FOCCO_8730.xlsx`
-- são FOCCO. O catálogo do site usa `product_code`, e para alguns produtos os
-- dois números não coincidem — o produto é o mesmo, o código não.
--
-- Quando isso acontece, o preço de funcionário fica pendurado num código que não
-- existe no catálogo e nunca alcança o produto. O funcionário via o preço cheio,
-- embora a planilha tivesse preço para aquele item.
--
-- A migration `20260828120000` tratou o caso grave, em que o código existia dos
-- dois lados apontando para produtos diferentes (whey isolado 400g vs 900g) e
-- saía preço **errado**. Aqui são os casos em que não saía preço **nenhum**.
--
-- ## Os pares, e por que são o mesmo produto
--
--   planilha 4008 · BIOFIT HIBISCO sabor HIBISCO            R$ 16,42
--   catálogo 7912 · BIOFIT- Sabor Hibisco - 200g            R$ 29,99
--     O irmão de sabor (4009, Abacaxi com Hortelã) tem o mesmo código nos dois
--     cadastros e o mesmo R$ 29,99 de tabela. Só o Hibisco foi recadastrado.
--
--   planilha 7197 · Cap. TREONAT MAIS - 530mg - 60 cápsulas R$ 13,85
--   catálogo 7921 · TREONAT MAIS - Magnésio e L-Treonina - 60 Cápsulas  R$ 29,99
--   catálogo 7408 · Suplemento de Magnésio e Treonina em cápsulas       R$ 29,99
--     São **dois cadastros do mesmo produto** no catálogo: mesma marca, mesma
--     categoria (Cápsula/Suplemento), mesmo preço, e as duas descrições falam de
--     magnésio com L-treonina em 60 cápsulas. O preço entra nos dois para o
--     funcionário não pagar valores diferentes conforme o card em que clicar.
--     A duplicidade em si é problema de cadastro e fica registrada aqui.
--
--   planilha 7490 · KIT CHÁ SUBLIME NOITE COM MELATONINA 30 sachês + 36 cápsulas  R$ 23,20
--   catálogo 7854 · SUBLIME NOITE E MELATONINA - Chá e Cápsula - 30 Sachês e 36 Cápsulas  R$ 69,99
--     A composição bate item a item. É o único kit com essa combinação nos dois
--     cadastros.
--
-- ## As linhas antigas continuam
--
-- 4008, 7197 e 7490 não são apagados. Eles são o registro fiel da planilha, não
-- encostam em nenhum produto do catálogo e não têm efeito. Apagá-los faria a
-- tabela divergir da origem sem ganho.
--
-- ## ⚠️ Reaplicar a 20260825120000 apaga isto
--
-- Aquela migration começa com
--   `delete ... where customer_type='funcionario' and proxis_tpr_id is null`
-- e recarrega os 160 preços da planilha. Rodá-la de novo desfaz esta correção e
-- a da 20260828120000. Se precisar recarregar a tabela do zero, rode as três na
-- ordem.
--
-- ## O que fica de fora, por decisão
--
-- Outros 17 códigos da planilha não têm produto no catálogo porque o produto não
-- é vendido no site (caixas de madeira, chá verde 30 sachês, mate tostado,
-- xilitol, creatina 150g, whey isolado 400g, goma pré-treino, goma mix cabelos e
-- unhas, chá verde/rosas/jasmim). Não há a que aplicar. A regra vale: sem preço
-- de funcionário, vale o preço de cliente.

insert into public."clinic+b2b_customer_price_overrides"
  (customer_type, product_code, price, active)
values
  ('funcionario', '7912', 16.42, true),  -- BIOFIT Hibisco 200g        (planilha 4008)
  ('funcionario', '7921', 13.85, true),  -- TREONAT MAIS 60 cáps       (planilha 7197)
  ('funcionario', '7408', 13.85, true),  -- TREONAT MAIS, 2º cadastro  (planilha 7197)
  ('funcionario', '7854', 23.20, true);  -- Kit Sublime Noite + Melatonina (planilha 7490)
