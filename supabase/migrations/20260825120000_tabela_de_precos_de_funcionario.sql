-- Tabela "Clinic 2026 Funcionários" — o primeiro preço que o site NÃO copia do Proxis.
--
-- ## O que mudou, e por quê
--
-- Até aqui o site era espelho: as quatro tabelas em uso (8728, 8729, 8744, 8745)
-- vinham da sincronização com o ERP, 567 preços ao todo, nenhum digitado à mão.
--
-- Em 25/08/2026 o responsável pelo ERP decidiu o contrário para os funcionários:
--
--   > "No PROXIS deixa fora, deixa manual."
--   > "caso de problema em subir automatico no proxis, [...] deixa apenas a
--   >  opcao de gerar"
--
-- Então esta tabela **não existe no Proxis** e não tem `tpr_id`. Ela mora aqui, e
-- este arquivo passa a ser o único registro dos 160 preços — não há ERP de onde
-- recuperá-los. Origem: `TABELA CLINIC 2026 Funcionários_COD_FOCCO_8730.xlsx`,
-- coluna "PREÇO COMPRA"/"PREÇO UNITÁRIO".
--
-- (O 8730 do nome do arquivo é código FOCCO, não Proxis. Não vira `tpr_id`.)
--
-- ## Como ela se encaixa no modelo que já existe
--
-- `clinic+b2b_customer_price_overrides` tem duas camadas: a geral, por
-- `customer_type` com `proxis_tpr_id IS NULL`, e a do cliente, por `proxis_tpr_id`.
-- A tabela de funcionário é a **camada geral do tipo `funcionario`** — encaixe
-- exato, sem coluna nova. `funcionario` já era um `customer_type` previsto em
-- `src/lib/pricing.ts`; só não havia ninguém usando.
--
-- ## Consequência: o pedido do funcionário não sobe ao ERP
--
-- Um pedido com preço de funcionário chegaria ao Proxis carimbado com a 8728, que
-- é a tabela que o CNPJ tem lá — itens abaixo da tabela carimbada, sem documento
-- que explique. Por isso os pedidos de funcionário param na plataforma. A trava
-- fica em `api/proxis-order.ts` (servidor) e o pedido nasce marcado pelo gatilho
-- no fim deste arquivo.

-- ---------------------------------------------------------------------------
-- 1. Os 160 preços
-- ---------------------------------------------------------------------------

-- Apagar antes de inserir, e não `on conflict`: a tabela não tem índice único
-- sobre (customer_type, product_code, proxis_tpr_id), então não há em que
-- conflitar. O `delete` é restrito ao tipo `funcionario` e à camada sem TPR, ou
-- seja, não encosta nas quatro tabelas vindas do Proxis.
delete from public."clinic+b2b_customer_price_overrides"
 where customer_type = 'funcionario' and proxis_tpr_id is null;

-- Item 7487 (CREATINA Monohidratada, R$ 34,67) entra **acima** do preço de
-- cadastro, que é R$ 27,99 — o funcionário pagaria mais que o visitante.
-- É o único caso entre os 140 que casam com o catálogo. Está aqui como veio da
-- planilha, de propósito: corrigir preço de terceiro sem confirmação seria pior
-- que registrar a divergência. Pendente de confirmação com o ERP.
insert into public."clinic+b2b_customer_price_overrides"
  (customer_type, product_code, price, active)
values
  ('funcionario', '7487', 34.67, true),  -- AMINOACIDO · CREATINA Monohidratada
  ('funcionario', '6741', 19.80, true),  -- AMINOACIDO · CREATINA Monohidratada
  ('funcionario', '7229', 11.82, true),  -- AMINOACIDO · CREATINA MONOHIDRATADA - 650MG - 60 CÁP
  ('funcionario', '14210', 37.99, true),  -- AMINOACIDO · GLUTAMINA (L-Glutamina)
  ('funcionario', '7703', 35.91, true),  -- AMINOACIDO · PRÉ TREINO SABOR FRUTAS VERMELHAS - 240GR
  ('funcionario', '6273', 115.48, true),  -- WHEY ISOLADO · WHEY WHEY ELLA MAIS ISOLADO VERISOl sabor Banana Flambada 
  ('funcionario', '7513', 116.74, true),  -- WHEY ISOLADO · WHEY ELLA MAIS ISOLADO VERISOL sabor MOUSSE DE LIMÃO
  ('funcionario', '5840', 113.23, true),  -- WHEY ISOLADO · WHEY WHEY ELLA MAIS ISOLADO VERISOl sabor Neutro (24g de p
  ('funcionario', '7178', 299.89, true),  -- WHEY ISOLADO · WHEY MAIS ISOLADO sabor neutro 900g (31g de proteína por p
  ('funcionario', '7179', 137.76, true),  -- WHEY ISOLADO · WHEY MAIS ISOLADO sabor neutro 400g (31g de proteína por p
  ('funcionario', '5844', 76.17, true),  -- WHEY ISOLADO · REVITÁ PLENO sabor Baunilha 300G (20g de proteína por porç
  ('funcionario', '6947', 141.02, true),  -- WHEY CONCENTRADO · Whey MAIS 100% CONCENTRATE sabor Morango – POTE RANDON (21
  ('funcionario', '6946', 171.04, true),  -- WHEY CONCENTRADO · Whey MAIS 100% CONCENTRATE sabor Chocolate Belga – POTE RA
  ('funcionario', '6945', 141.67, true),  -- WHEY CONCENTRADO · Whey MAIS 100% CONCENTRATE Sabor Banana Caramelizada e Bau
  ('funcionario', '6980', 93.54, true),  -- WHEY CONCENTRADO · Whey MAIS CONCENTRADO – COMBATE – Sabor Morango (12g de pr
  ('funcionario', '6981', 93.98, true),  -- WHEY CONCENTRADO · Whey MAIS CONCENTRADO – COMBATE – Sabor Chocolate (12g de 
  ('funcionario', '6979', 91.38, true),  -- WHEY CONCENTRADO · Whey MAIS CONCENTRADO – COMBATE – Sabor Quatro Leites e Ba
  ('funcionario', '7203', 21.41, true),  -- CAFÉ TERMOGENICO/CHOCOMAIS · CAFÉ TERMOGENICO SABOR CHOCOLATE - 220G
  ('funcionario', '6743', 21.82, true),  -- CAFÉ TERMOGENICO/CHOCOMAIS · CHOCOMAIS com Vitaminas e Minerais sabor CHOCOLATE
  ('funcionario', '6797', 24.70, true),  -- SHAKES · SHAKE COM CHIA BIOFORMA Sabor Banana com Canela
  ('funcionario', '6747', 26.07, true),  -- SHAKES · SHAKE COM CHIA BIOFORMA Sabor Morango
  ('funcionario', '6562', 56.90, true),  -- SOLÚVEL SACHÊS · CLORETO DE MAGNÉSIO caixa com 20 sachês
  ('funcionario', '7719', 13.44, true),  -- SOLÚVEL SACHÊS · SOLÚVEL ACETILCISTEÍNA SABOR LARANJA - Caixa com 16 sachês
  ('funcionario', '12596', 73.89, true),  -- SOLÚVEL SACHÊS · MUNE + Sabor Laranja caixa c/ 10 sachês
  ('funcionario', '6866', 5.42, true),  -- SULFATO DE MAGNÉSIO · SAL AMARGO (Sulfato de Magnésio 100% pó) Produto Vegano
  ('funcionario', '3605', 32.89, true),  -- LINHA SOLÚVEL LATA · XILITOL MAIS 300GR
  ('funcionario', '16060', 21.44, true),  -- LINHA SOLÚVEL LATA · 4 FIBER sabor Neutro
  ('funcionario', '4009', 17.45, true),  -- LINHA SOLÚVEL LATA · BIOFIT CHA VERDE com Couve, Salvia e Salsa sabor ABACAXI C
  ('funcionario', '4008', 16.42, true),  -- LINHA SOLÚVEL LATA · BIOFIT HIBISCO sabor HIBISCO - (Adoçado com STÉVIA)
  ('funcionario', '3599', 33.45, true),  -- LINHA SOLÚVEL LATA · ARTIMAG Colágeno TIPO II Sabor Neutro (40Mg de colágeno p/
  ('funcionario', '7431', 99.14, true),  -- COLÁGENOS · COLÁGENO BODYBALANCE 450G
  ('funcionario', '4439', 37.14, true),  -- COLÁGENOS · HYALURON+ Sabor Neutro 275G (80Mg de AH p/ porção)
  ('funcionario', '7897', 46.41, true),  -- COLÁGENOS · PEPTGEN DERMA 9 PREMIUM sabor Abacaxi com Hortelã
  ('funcionario', '7896', 48.04, true),  -- COLÁGENOS · PEPTGEN DERMA 9 PREMIUM sabor Frutas Vermelhas
  ('funcionario', '4463', 48.35, true),  -- COLÁGENOS · PEPTGEN DERMA 9 PREMIUM sabor Limão Siciliano
  ('funcionario', '4465', 47.13, true),  -- COLÁGENOS · PEPTGEN DERMA 9 PREMIUM sabor Neutro
  ('funcionario', '5902', 61.75, true),  -- COLÁGENOS · PEPTGEN CARE VERISOL+ÁCIDO HIALURÔNICO sabor NEUTRO 200gr
  ('funcionario', '5899', 38.78, true),  -- COLÁGENOS · PEPTGEN CARE VERISOL sabor NEUTRO 200gr
  ('funcionario', '5900', 42.41, true),  -- COLÁGENOS · PEPTGEN CARE VERISOL sabor LARANJA 200gr
  ('funcionario', '5901', 38.10, true),  -- COLÁGENOS · PEPTGEN CARE VERISOL sabor PINÃ COLADA 200gr
  ('funcionario', '7889', 22.97, true),  -- LINHA LEVEZA 30 · SKAKE LEVEZA 30 com INOSITOL e LARANJA MORO sabor BAUNILHA
  ('funcionario', '7596', 6.41, true),  -- LINHA LEVEZA 30 · Chá LEVEZA 30 – 15 sachês (Sabor Pink Lemonade)
  ('funcionario', '6604', 15.48, true),  -- LINHA LEVEZA 30 · Chá LEVEZA 30 – 30 sachês (Sabor Pink Lemonade)
  ('funcionario', '4160', 13.03, true),  -- LINHA LEVEZA 30 · Chá LEVEZA 30 – DIA (Chá Misto de Carqueja, Hortelã, Chá V
  ('funcionario', '7490', 23.20, true),  -- KIT CHÁ SUBLIME NOITE E MELATONINA EM CÁPSULAS · KIT CHÁ SUBLIME NOITE COM MELATONINA 30 sachês + 36 cápsul
  ('funcionario', '6793', 12.09, true),  -- CÁPSULAS OLEOSAS · Cáp. OLEO DE CHIA + OLEO DE COCO – 60 cap.
  ('funcionario', '6705', 16.72, true),  -- CÁPSULAS OLEOSAS · Cáp. 3 ÔMEGAS Peixe 18/12, Linhaça e Borragem 1000mg – 60 
  ('funcionario', '7463', 9.99, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE CARTAMO – 60 cáp. NOVO CÓDIGO
  ('funcionario', '7501', 11.43, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE CHIA, CÁRTAMO E COCO 60 cáp LANÇAMENTO
  ('funcionario', '7177', 13.00, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE ABACATE (Óleo de Abacate + Vitamina E) – 1000
  ('funcionario', '4540', 8.24, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE ALHO 500mg – 60 cáp.
  ('funcionario', '5284', 11.59, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE COCO 60 cáp.
  ('funcionario', '6263', 9.89, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE LINHAÇA 1000mg – 60 cáp.
  ('funcionario', '7161', 11.19, true),  -- CÁPSULAS OLEOSAS · Cáp. 5 ÓLEOS ( Linhaça+Óleo de Girassol+Cártamo+Óleo de Bo
  ('funcionario', '6358', 13.08, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE PRÍMULA 1000mg – 60 cáp.
  ('funcionario', '7475', 15.04, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE PRÍMULA E BORRAGEM + L-TRIPTOFANO 60 cáp LANÇ
  ('funcionario', '6560', 13.34, true),  -- CÁPSULAS OLEOSAS · Cáp. ÓLEO DE SEMENTE DE ABÓBORA 1400mg – 60 cáp.
  ('funcionario', '7230', 31.74, true),  -- CÁPSULAS OLEOSAS · Cáp. ÔMEGA 3 +1000 Óleo de Peixe 1000mg – 90 cáp.
  ('funcionario', '7523', 40.02, true),  -- CÁPSULAS OLEOSAS · Cáp. ÔMEGA-3 DO ALASKA - Óleo de Peixe e Vitamina E em cáp
  ('funcionario', '5037', 8.87, true),  -- CÁPSULAS OLEOSAS · Cáp. VITAMINA D3 com 2000 U.I – 500mg – 30 cáp.
  ('funcionario', '7909', 26.10, true),  -- CÁPSULAS PÓ · Cáp. ARTIMAG (Colágeno TIPO II e Magnésio 600mg – 60 cap.
  ('funcionario', '7507', 32.80, true),  -- CÁPSULAS PÓ · Cáp. GLUCOSAMINA MSM COLÁGENO TIPO II 60 cáp LANÇAMENTO
  ('funcionario', '4266', 12.99, true),  -- CÁPSULAS PÓ · Cáp. ANSIOZEN (L-Triptofano + Magnésio) 450mg – 60 cap.
  ('funcionario', '6746', 11.58, true),  -- CÁPSULAS PÓ · Cáp. BIOBEARD (Barba e Cabelo) 480mg – 30 cáp.
  ('funcionario', '3699', 11.58, true),  -- CÁPSULAS PÓ · Cáp. BIOBELLA (Cabelos e Unhas) 480mg – 30 cáps.
  ('funcionario', '7498', 13.16, true),  -- CÁPSULAS PÓ · Cáp. CAFFEINE 28,8g Caffeine mais Verde 60 cápsulas
  ('funcionario', '7525', 44.92, true),  -- CÁPSULAS PÓ · Cáp. MORO MAIS - café verde, laranja moro e cromo em cápsu
  ('funcionario', '6829', 19.49, true),  -- CÁPSULAS PÓ · Cáp. CALMAIS Alga Lithothamnium 760mg - 60 cáp.
  ('funcionario', '7876', 18.37, true),  -- CÁPSULAS PÓ · Cáp. CALMAIS K2+D3 620 mg ( Magnésio e Cúrcuma em cápsulas
  ('funcionario', '7585', 21.98, true),  -- CÁPSULAS PÓ · Cáp. CRANBERRY 430mg – 30 caps
  ('funcionario', '7509', 12.24, true),  -- CÁPSULAS PÓ · Cáp. CÚRCUMA 480mg - 30 cáps
  ('funcionario', '5551', 17.44, true),  -- CÁPSULAS PÓ · Cáp. HYALURON + ÁCIDO HIALURÔNICO 400mg – 30 cap
  ('funcionario', '7226', 24.65, true),  -- CÁPSULAS PÓ · Cáp. LICOPENO resveratrol+ vitamina c + selenio - 550mg – 
  ('funcionario', '6731', 13.60, true),  -- CÁPSULAS PÓ · Cáp LUTEÍNA & ZEAXANTINA 450mg – 30 cáp
  ('funcionario', '6404', 7.30, true),  -- CÁPSULAS PÓ · Cáp.. MELATONINA 520mg – 30 cáps
  ('funcionario', '7457', 16.55, true),  -- CÁPSULAS PÓ · Cáp. MULTIVITAMINAS MAIS (Multivitaminas e Minerais de A a
  ('funcionario', '6767', 11.60, true),  -- CÁPSULAS PÓ · Cáp. PEPTGENDERMA COLÁGENO HIDROLISADO FRAGMENTADO 570mg –
  ('funcionario', '7518', 19.75, true),  -- CÁPSULAS PÓ · Cáp. REJUVECEL Q10+ (Coenzima Q10 + Semente de Uva) 450ng 
  ('funcionario', '7139', 16.33, true),  -- CÁPSULAS PÓ · Cáp. SPIRULINA Arthrospira platensis 60 cápsulas
  ('funcionario', '7500', 17.66, true),  -- CÁPSULAS PÓ · Cáp. MIX 5 MAGNÉSIOS 90 cáp LANÇAMENTO
  ('funcionario', '7464', 13.53, true),  -- CÁPSULAS PÓ · Cáp. SUPLEMENTO MAGNÉSIO MALATO 530mg – 60 cáp LANÇAMENTO
  ('funcionario', '7197', 13.85, true),  -- CÁPSULAS PÓ · Cap. TREONAT MAIS - 530mg - 60 cápsulas
  ('funcionario', '9835', 10.96, true),  -- CÁPSULAS PÓ · Cap. SUPLEMENTO PICOLINATO DE CROMO 60 cáp.
  ('funcionario', '6754', 8.86, true),  -- CÁPSULAS PÓ · Cap. SUPLEMENTO SELÊNIO Quelato 400mg – 60 cáp.
  ('funcionario', '7187', 9.17, true),  -- CÁPSULAS PÓ · Cáp. SUPLEMENTO VITAMINA B12 500mg – 30 cáp. (CAPS VEGANA)
  ('funcionario', '7136', 11.34, true),  -- CÁPSULAS PÓ · Cáp. VITAMINA C + ZINCO 30 cápsulas - - CAP VEGANA
  ('funcionario', '7208', 13.58, true),  -- CÁPSULAS PÓ · Cáp. VITAMINA E 670mg – 30 cap.
  ('funcionario', '6931', 11.41, true),  -- CÁPSULAS PÓ · Cáp. SUPLEMENTO VITAMINA K2 + D3 2000UI 500mg - 30 cáps ME
  ('funcionario', '4031', 9.67, true),  -- CÁPSULAS PÓ · Cáp. SUPLEMENTO VITAMINA K2 550mg – 30 cap. MENAQUINONA-7
  ('funcionario', '7462', 13.59, true),  -- CÁPSULAS PÓ · Cáp. SUPLEMENTO VITAMINA B (Complexo B) 500mg – 60 cáp. NO
  ('funcionario', '5978', 7.86, true),  -- CÁPSULAS PÓ · Cáp. SUPLEMENTO ZINCO QUELATO 500mg – 30 cáp. 414% IDR
  ('funcionario', '7446', 49.84, true),  -- CÁPSULAS PÓ · Cáp. FENO GREGO 600mg - 30 cáps LANÇAMENTO
  ('funcionario', '7739', 15.97, true),  -- CÁPSULAS PÓ · Cáp. SUPLEMENTO CLORETO DE MAGNÉSIO 500mg – 60 cáp. (CAPS 
  ('funcionario', '7405', 18.44, true),  -- CÁPSULAS PÓ · Cap GREEN+CLORELLA 60CAPS 500MG 30G REFORMULADO
  ('funcionario', '7597', 10.91, true),  -- CÁPSULAS PÓ · Cáp. Pré Treino com Beta-Alanina
  ('funcionario', '7740', 10.16, true),  -- CÁPSULAS PÓ · CÁPSULA BIOFEMME MAIS - 30 CÁPSULAS
  ('funcionario', '7685', 16.48, true),  -- CÁPSULAS PÓ · CÁPSULA BIOBELLA COR - 30 CÁPSULAS
  ('funcionario', '8075', 20.10, true),  -- CÁPSULAS PÓ · CÁPSULA ACETILCISTEÍNA - 30 CÁPSULAS
  ('funcionario', '2096', 3.83, true),  -- LINHA MATE · MATE TOSTADO NATURAL 25 Sachês
  ('funcionario', '6170', 19.19, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 04 Sabores (Cor Branca / sem os chás)
  ('funcionario', '6171', 16.84, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 04 Sabores (Cru / sem os chás)
  ('funcionario', '24847', 42.34, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 04 Sabores (Preta Sem os Chás)
  ('funcionario', '24846', 47.64, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 06 Sabores (Preta Sem os Chás)
  ('funcionario', '27411', 51.61, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 04 Sabores (Cinza Sem os Chás)
  ('funcionario', '27412', 59.55, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 06 Sabores (Cinza Sem os Chás)
  ('funcionario', '27413', 71.46, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 09 Sabores (Cinza Sem os Chás)
  ('funcionario', '27414', 112.48, true),  -- CAIXAS DE MADEIRA · Cx. Madeira 16 Sabores (Cinza Sem os Chás)
  ('funcionario', '7438', 6.18, true),  -- CHÁS DE INFUSÃO GELADA E QUENTE 15 SACHÊS · BOM DIA (hibisco, mate verde e estévia com cranberry solúv
  ('funcionario', '7439', 5.43, true),  -- CHÁS DE INFUSÃO GELADA E QUENTE 15 SACHÊS · BOA TARDE (hortelã, chá verde, abacaxi, mate verde e estév
  ('funcionario', '7437', 5.24, true),  -- CHÁS DE INFUSÃO GELADA E QUENTE 15 SACHÊS · BOA NOITE (maracujá, camomila, capim-cidreira e estévia co
  ('funcionario', '5058', 13.81, true),  -- CHÁS 30 SACHÊS · Chá BIO RESFRIN - 30 Sachês
  ('funcionario', '1200', 4.02, true),  -- CHÁS 30 SACHÊS · Chá VERDE - 30 Sachês
  ('funcionario', '12322', 2.24, true),  -- CHÁS 10 SACHÊS · Sublime BRISA (Biorelax) Chá misto de maracujá, maçã, capi
  ('funcionario', '12324', 1.98, true),  -- CHÁS 10 SACHÊS · Sublime DIVA (Feminino) Chá misto de hortelã, camomila, ma
  ('funcionario', '12326', 2.49, true),  -- CHÁS 10 SACHÊS · Sublime ENERGIA (Bioenergy) Chá misto de guaraná, laranja,
  ('funcionario', '12328', 1.94, true),  -- CHÁS 10 SACHÊS · Sublime ESSÊNCIA (Colesteron) Chá misto de camomila, melis
  ('funcionario', '12332', 2.06, true),  -- CHÁS 10 SACHÊS · Sublime HARMONIA (Biouric) Chá misto de camomila, carqueja
  ('funcionario', '12334', 1.89, true),  -- CHÁS 10 SACHÊS · Sublime INOCÊNCIA (Chá do Bebê) (Chá misto de erva-doce, f
  ('funcionario', '12336', 2.77, true),  -- CHÁS 10 SACHÊS · Sublime INVERNO (Resfrin) Chá misto de laranja, limão, hor
  ('funcionario', '12338', 2.22, true),  -- CHÁS 10 SACHÊS · Sublime LEVEZA (Biodigest) Chá misto de carqueja, funcho, 
  ('funcionario', '12340', 2.05, true),  -- CHÁS 10 SACHÊS · Sublime LIBERDADE (Biobets) Chá misto de carqueja, boldo, 
  ('funcionario', '12342', 2.10, true),  -- CHÁS 10 SACHÊS · Sublime NOITE (Sonho dos Anjos) Chá misto de melissa, mara
  ('funcionario', '12344', 2.91, true),  -- CHÁS 10 SACHÊS · Sublime PAIXÃO Sabor Cereja e Framboesa (Explode coração) 
  ('funcionario', '12348', 2.14, true),  -- CHÁS 10 SACHÊS · Sublime TERNURA (Biomama) Chá misto de erva-doce, funcho, 
  ('funcionario', '7413', 1.70, true),  -- CHÁS 10 SACHÊS · Chá FUNCHO LANÇAMENTO
  ('funcionario', '51', 1.72, true),  -- CHÁS 10 SACHÊS · Chá VERDE
  ('funcionario', '48', 2.07, true),  -- CHÁS 10 SACHÊS · Chá VERDE C/ HORTELÃ, LARANJA E LIMÃO sabor Hortelã e Limã
  ('funcionario', '50', 2.82, true),  -- CHÁS 10 SACHÊS · Chá VERDE, ROSAS, JASMIM E HIBISCO sabor Framboesa
  ('funcionario', '29', 1.73, true),  -- CHÁS 10 SACHÊS · Chá PRETO
  ('funcionario', '30', 2.01, true),  -- CHÁS 10 SACHÊS · Chá PRETO COM GENGIBRE E CANELA
  ('funcionario', '74', 2.02, true),  -- CHÁS 10 SACHÊS · Chá SETE ERVAS
  ('funcionario', '2188', 2.50, true),  -- CHÁS 10 SACHÊS · Chá ANIS ESTRELADO
  ('funcionario', '4', 1.78, true),  -- CHÁS 10 SACHÊS · Chá BOLDO
  ('funcionario', '5', 1.45, true),  -- CHÁS 10 SACHÊS · Chá CAMOMILA
  ('funcionario', '4282', 1.85, true),  -- CHÁS 10 SACHÊS · Chá de CAMOMILA E LARANJA Sabor Mel 10 Sachês
  ('funcionario', '12', 1.54, true),  -- CHÁS 10 SACHÊS · Chá CIDREIRA
  ('funcionario', '5288', 2.16, true),  -- CHÁS 10 SACHÊS · Chá misto de mate tostado, mate verde e CAPIM-CIDREIRA com
  ('funcionario', '6', 1.48, true),  -- CHÁS 10 SACHÊS · Chá CARQUEJA
  ('funcionario', '15', 2.01, true),  -- CHÁS 10 SACHÊS · Chá ERVA DOCE
  ('funcionario', '36', 2.58, true),  -- CHÁS 10 SACHÊS · Chá misto mate verde, maça e capim-cidreira com GENGIBRE C
  ('funcionario', '1359', 2.25, true),  -- CHÁS 10 SACHÊS · Chá de HIBISCO 10 sachês
  ('funcionario', '22', 1.46, true),  -- CHÁS 10 SACHÊS · Chá HORTELÃ
  ('funcionario', '25', 1.88, true),  -- CHÁS 10 SACHÊS · Chá MELISSA
  ('funcionario', '268', 2.64, true),  -- CHÁS 10 SACHÊS · Chá ABACAXI HORTELÃ C/ CANELA E CRAVO
  ('funcionario', '456', 2.45, true),  -- CHÁS 10 SACHÊS · Chá ABACAXI, HORTELÃ, CHÁ VERDE E GENGIBRE
  ('funcionario', '35', 2.87, true),  -- CHÁS 10 SACHÊS · Chá FLORES E FRUTAS
  ('funcionario', '64', 2.96, true),  -- CHÁS 10 SACHÊS · Chá FRUTAS TROPICAIS
  ('funcionario', '4280', 3.15, true),  -- CHÁS 10 SACHÊS · Chá FRUTAS VERMELHAS Sabor Morango
  ('funcionario', '37', 2.94, true),  -- CHÁS 10 SACHÊS · Chá MAÇA
  ('funcionario', '38', 2.74, true),  -- CHÁS 10 SACHÊS · Chá MAÇA COM CANELA
  ('funcionario', '40', 2.75, true),  -- CHÁS 10 SACHÊS · Chá MAÇA com GENGIBRE, CANELA E CRAVO sabor Maçã
  ('funcionario', '41', 2.75, true),  -- CHÁS 10 SACHÊS · Chá MARACUJÁ
  ('funcionario', '42', 3.01, true),  -- CHÁS 10 SACHÊS · Chá MORANGO
  ('funcionario', '43', 2.96, true),  -- CHÁS 10 SACHÊS · Chá PÊSSEGO sabor Pêssego
  ('funcionario', '4283', 2.88, true),  -- CHÁS 10 SACHÊS · Chá SILVESTRE sabor artificial de Cereja e Framboesa 10 Sa
  ('funcionario', '7678', 33.70, true),  -- GOMAS · GOMA CREATINA SABOR MAÇÃ VERDE - 60 GOMAS
  ('funcionario', '7666', 16.10, true),  -- GOMAS · GOMA VITAMINA C + ZINCO - 30 GOMAS
  ('funcionario', '7671', 13.83, true),  -- GOMAS · GOMA MELATONINA - 30 GOMAS
  ('funcionario', '7676', 22.52, true),  -- GOMAS · GOMA PRÉ TREINO SABOR MAÇÃ VERDE – 60 GOMAS
  ('funcionario', '8147', 16.43, true)  -- GOMAS · GOMA MIX CABELOS E UNHAS SABOR MORANGO - 30 GOMAS
;

-- ---------------------------------------------------------------------------
-- 2. Os funcionários passam a ser `funcionario`
-- ---------------------------------------------------------------------------
--
-- Os 96 estavam como `cliente`, e 93 deles com `proxis_tpr_id = 8728` — a tabela
-- de representante nacional, escrita pela sincronização com o Proxis quando o
-- painel criou cada conta com o CNPJ da Clinic+.
--
-- As duas mudanças são necessárias juntas. Só trocar o tipo não bastaria: a
-- camada do TPR fica **acima** da geral em `mergePriceLayers`, então a 8728
-- continuaria vencendo a tabela nova item a item.
--
-- `linked_company_cnpj` é o marcador porque é o que define funcionário desde a
-- criação (`listEmployees` usa exatamente isto) e nenhum outro perfil o tem —
-- conferido: 96 linhas, todas com 04163851000106.
update public."clinic+b2b_customer_profiles"
   set customer_type = 'funcionario',
       proxis_tpr_id = null,
       updated_at = now()
 where linked_company_cnpj is not null
   and (customer_type is distinct from 'funcionario' or proxis_tpr_id is not null);

-- ---------------------------------------------------------------------------
-- 3. A sincronização com o Proxis para de carimbar TPR em funcionário
-- ---------------------------------------------------------------------------
--
-- Sem isto o passo 2 duraria até o próximo login: `syncCustomerProxisLink` é
-- chamada em seis lugares (login, checkout, conta, painel de clientes e duas
-- vezes no painel de funcionários), consulta o CNPJ da Clinic+ no ERP, recebe
-- 8728 de volta e regrava. A tabela de funcionário sumiria sozinha.
--
-- A trava fica **aqui**, e não nos seis chamadores, porque é o único ponto por
-- onde todos passam — inclusive o próximo que alguém escrever.
--
-- `proxis_pes_id` e `proxis_found` continuam sendo gravados: identificam a ficha
-- da empresa no ERP e são úteis no painel. O que não pode voltar é o `tpr_id`,
-- porque é ele que decide preço.
create or replace function public.sync_customer_proxis_link(
  p_proxis_pes_id integer default null,
  p_proxis_tpr_id integer default null,
  p_proxis_found boolean default false,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_eh_funcionario boolean;
  v_tpr integer;
begin
  v_user_id := coalesce(p_user_id, auth.uid());

  if v_user_id is null then
    raise exception 'Nao autenticado';
  end if;

  if p_user_id is not null and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem sincronizar para outro usuario';
  end if;

  select (customer_type = 'funcionario' or linked_company_cnpj is not null)
    into v_eh_funcionario
    from public."clinic+b2b_customer_profiles"
   where user_id = v_user_id;

  -- Os dois critérios com `or`, e não só o tipo: uma conta recém-criada pelo
  -- painel tem `linked_company_cnpj` antes de qualquer coisa acertar o tipo, e é
  -- justamente nesse instante que a sincronização roda pela primeira vez.
  v_tpr := case when coalesce(v_eh_funcionario, false) then null else p_proxis_tpr_id end;

  if v_tpr is not null then
    insert into public."clinic+b2b_price_tables" (tpr_id, name, active)
    values (v_tpr, 'Tabela Proxis #' || v_tpr, true)
    on conflict (tpr_id) do nothing;
  end if;

  update public."clinic+b2b_customer_profiles"
     set proxis_pes_id = p_proxis_pes_id,
         proxis_tpr_id = v_tpr,
         proxis_found = coalesce(p_proxis_found, false),
         proxis_synced_at = now(),
         updated_at = now()
   where user_id = v_user_id;
end;
$$;

comment on function public.sync_customer_proxis_link(integer, integer, boolean, uuid) is
  'Grava a ficha do Proxis no perfil. Funcionário nunca recebe tpr_id: o preço dele vem da tabela manual de 2026, e um TPR do ERP passaria por cima dela.';

-- ---------------------------------------------------------------------------
-- 4. O pedido de funcionário nasce marcado
-- ---------------------------------------------------------------------------
--
-- "vai ter sempre um aviso quando é um funcionário" — e o aviso não pode
-- depender do navegador mandar um campo. O gatilho lê o perfil de quem está
-- inserindo e decide sozinho.
--
-- `nao_aplicavel` é status novo no vocabulário de `proxisOrderStatus.ts`. Sem
-- ele, o pedido ficaria em `pendente` para sempre e entulharia a fila de
-- reconciliação do painel com pedidos que nunca vão ao ERP por decisão.
create or replace function public.marcar_pedido_de_funcionario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_eh_funcionario boolean;
begin
  -- Sem sessão (checkout de visitante) não há perfil para consultar, e o pedido
  -- segue o caminho normal.
  if auth.uid() is null then
    return new;
  end if;

  select (customer_type = 'funcionario' or linked_company_cnpj is not null)
    into v_eh_funcionario
    from public."clinic+b2b_customer_profiles"
   where user_id = auth.uid();

  if coalesce(v_eh_funcionario, false) then
    new.proxis_status := 'nao_aplicavel';
  end if;

  return new;
end;
$$;

drop trigger if exists marcar_pedido_de_funcionario on public."clinic+b2b_orders";
create trigger marcar_pedido_de_funcionario
  before insert on public."clinic+b2b_orders"
  for each row execute function public.marcar_pedido_de_funcionario();

comment on function public.marcar_pedido_de_funcionario() is
  'Marca proxis_status = nao_aplicavel quando quem compra é funcionário. A decisão é do servidor: o navegador não é consultado.';
