-- Apaga as tabelas de preço que ninguém usa.
--
-- ## O pedido
--
-- "não faz sentido estar mostrando em tabelas de preços um total de seis
-- tabelas e quando eu desço mostra só quatro, porque outras duas não têm nenhuma
-- conta que compra por elas. Pra mim, se não tem nenhuma conta associada, pra
-- mim remove. Remove 100%."
--
-- ## O critério, agora que um tipo também pode usar uma tabela
--
-- "Sem uso" passou a ter duas metades, e as duas precisam ser falsas:
--
--   1. nenhuma **conta** com ela como negociação individual
--      (`customer_profiles.proxis_tpr_id`);
--   2. nenhum **tipo** apontando para ela
--      (`customer_types.price_table_id` — coluna criada hoje).
--
-- Sem a segunda, esta migration apagaria a tabela de um tipo inteiro no dia
-- seguinte a alguém ligar os dois — e todo cliente daquele tipo cairia no preço
-- de cadastro sem ninguém pedir.
--
-- ## ⚠️ Isto joga fora 297 preços
--
-- 8744 (Rio de Janeiro 2026) e 8745 (Representante Negociação Especial 2026)
-- têm 148 e 149 preços carregados e **nenhuma conta**. Alguém precificou e
-- nunca atribuiu.
--
-- O backup está em `documentation/backups/tabelas-sem-uso-01-09-2026.sql`, com
-- os `insert` prontos para reverter — é um arquivo, não uma promessa: rodar
-- aquele SQL devolve as duas tabelas e os 297 preços exatamente como estavam.
--
-- ## Pela regra, e não pela lista
--
-- Nada de `(8744, 8745)` cravado. Assim o arquivo continua verdadeiro se rodar
-- de novo, é idempotente, e não apaga o que ganhou uso nesse meio-tempo.

begin;

do $$
declare
  alvo record;
  total int := 0;
  precos int := 0;
begin
  for alvo in
    select t.tpr_id, t.name,
           (select count(*) from public."clinic+b2b_customer_price_overrides" o
             where o.proxis_tpr_id = t.tpr_id) as precos
      from public."clinic+b2b_price_tables" t
     where not exists (
       select 1 from public."clinic+b2b_customer_profiles" p where p.proxis_tpr_id = t.tpr_id
     )
       and not exists (
       select 1 from public."clinic+b2b_customer_types" ct where ct.price_table_id = t.tpr_id
     )
  loop
    raise notice 'apagando: % (%) — % preco(s) junto', alvo.name, alvo.tpr_id, alvo.precos;
    total := total + 1;
    precos := precos + alvo.precos;
  end loop;

  raise notice 'total: % tabela(s), % preco(s)', total, precos;
end
$$;

-- Os preços saem primeiro. Não há `foreign key` entre as duas tabelas — a
-- ordem é explícita justamente porque nada a garante.
delete from public."clinic+b2b_customer_price_overrides" o
 where o.proxis_tpr_id is not null
   and exists (
     select 1
       from public."clinic+b2b_price_tables" t
      where t.tpr_id = o.proxis_tpr_id
        and not exists (
          select 1 from public."clinic+b2b_customer_profiles" p where p.proxis_tpr_id = t.tpr_id
        )
        and not exists (
          select 1 from public."clinic+b2b_customer_types" ct where ct.price_table_id = t.tpr_id
        )
   );

delete from public."clinic+b2b_price_tables" t
 where not exists (
   select 1 from public."clinic+b2b_customer_profiles" p where p.proxis_tpr_id = t.tpr_id
 )
   and not exists (
   select 1 from public."clinic+b2b_customer_types" ct where ct.price_table_id = t.tpr_id
 );

commit;
