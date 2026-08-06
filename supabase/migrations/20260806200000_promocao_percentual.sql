-- Promocao que funciona junto com a tabela de preco do cliente (TPR).
--
-- O que existia: `is_promotion` era um booleano que so acendia selo e prateleira,
-- sem tocar em preco, e `compare_at_price` era um "de" **global**. Como o preco
-- exibido e por cliente (TPR do cliente -> tabela geral -> cadastro), preencher
-- um "de" global produzia desconto falso: o cliente da TPR que paga 51,99 num
-- produto de catalogo 79,99 veria "de 79,99 por 51,99, -35%" para sempre — e
-- isso nao e promocao, e a tabela comercial dele.
--
-- A solucao e **percentual**, e nao preco promocional fixo.
--
-- Preco fixo nao serve quando cada cliente tem uma base diferente: um
-- "R$ 59,90 promocional" pode ficar acima do que o distribuidor ja paga, e a
-- promocao viraria aumento. O percentual incide sobre a base de cada um, entao o
-- desconto e real para todos e o "de" exibido e sempre o preco que aquela pessoa
-- pagaria sem a promocao.
--
-- A janela de validade tira a promocao do ar sozinha. Sem ela, promocao acaba
-- quando alguem lembra de desmarcar.

alter table public."clinic+b2b_clinic_catalogo_front_b2b"
  add column if not exists promo_percent numeric(5,2),
  add column if not exists promo_starts_at timestamptz,
  add column if not exists promo_ends_at timestamptz;

-- Teto de 90%: acima disso e quase certo erro de digitacao (90 no lugar de 9,0),
-- e o piso evita percentual zero ou negativo ocupando a coluna.
alter table public."clinic+b2b_clinic_catalogo_front_b2b"
  drop constraint if exists clinic_b2b_produto_promo_percent_check;

alter table public."clinic+b2b_clinic_catalogo_front_b2b"
  add constraint clinic_b2b_produto_promo_percent_check
  check (promo_percent is null or (promo_percent > 0 and promo_percent <= 90));

-- Janela coerente: fim depois do inicio.
alter table public."clinic+b2b_clinic_catalogo_front_b2b"
  drop constraint if exists clinic_b2b_produto_promo_janela_check;

alter table public."clinic+b2b_clinic_catalogo_front_b2b"
  add constraint clinic_b2b_produto_promo_janela_check
  check (promo_starts_at is null or promo_ends_at is null or promo_ends_at > promo_starts_at);

-- A prateleira de promocao consulta por janela ativa.
create index if not exists clinic_b2b_produto_promo_idx
  on public."clinic+b2b_clinic_catalogo_front_b2b" (promo_ends_at)
  where promo_percent is not null;

-- `is_promotion` continua na tabela, mas deixa de mandar no preco: a partir de
-- agora quem decide selo, prateleira e desconto e a janela + o percentual. Os 4
-- produtos hoje marcados ficam sem promocao ativa ate alguem definir o
-- percentual — que e o correto, porque hoje eles nao tem desconto nenhum.
comment on column public."clinic+b2b_clinic_catalogo_front_b2b".is_promotion is
  'Legado. O selo e o preco promocional vem de promo_percent + janela.';
