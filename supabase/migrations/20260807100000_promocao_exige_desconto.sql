-- Destaque em Promocoes exige desconto.
--
-- `is_promotion` e curadoria: coloca o produto no carrossel "Promocoes" da home.
-- Ate aqui ele podia estar ligado com `promo_percent` nulo, e o produto entrava
-- na vitrine de ofertas com o preco cheio — anuncio de desconto que nao existe.
--
-- A regra ja vale no formulario (a chave nem liga sem percentual) e no salvamento.
-- Esta migracao e a terceira camada, a que nao depende de por onde o dado entrou:
-- import, correcao manual no painel do Supabase, script de carga.
--
-- A janela de datas de proposito nao entra na trava. `check` precisa ser
-- imutavel, e comparar com `now()` nao e; alem disso promocao agendada para a
-- semana que vem e legitima. Fora da janela o produto simplesmente nao aparece
-- como promocao — quem decide isso e `promocaoAtiva`, na leitura.

-- 1. Desliga o destaque de quem esta sem desconto.
--
-- Sem isso a restricao abaixo falharia na primeira linha invalida e a migracao
-- inteira ficaria pela metade. Nao apaga produto nem preco: so tira do carrossel
-- de ofertas quem nunca teve oferta nenhuma.
update "clinic+b2b_clinic_catalogo_front_b2b"
set is_promotion = false
where is_promotion is true
  and (promo_percent is null or promo_percent <= 0);

-- 2. A trava.
alter table "clinic+b2b_clinic_catalogo_front_b2b"
  drop constraint if exists clinic_b2b_produto_promocao_exige_desconto;

alter table "clinic+b2b_clinic_catalogo_front_b2b"
  add constraint clinic_b2b_produto_promocao_exige_desconto
  check (is_promotion is not true or promo_percent is not null);

comment on constraint clinic_b2b_produto_promocao_exige_desconto
  on "clinic+b2b_clinic_catalogo_front_b2b" is
  'Nao existe destaque em promocao sem percentual de desconto. O intervalo do percentual (0 < x <= 90) fica em clinic_b2b_produto_promo_percent_check.';
