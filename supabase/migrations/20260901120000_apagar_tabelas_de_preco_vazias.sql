-- Apaga as tabelas de preço que não têm nada dentro.
--
-- ## O que motivou
--
-- O seletor de tabela no cadastro do cliente listava as nove cadastradas, e
-- cinco delas não mudavam preço nenhum. Medido em 01/09/2026:
--
-- | tabela | contas | preços | pedidos |
-- |---|---|---|---|
-- | 40 Tabela padrão (catálogo) | 0 | 0 | 0 |
-- | 41 Tabela alternativa (catálogo -15%) | 0 | 0 | 0 |
-- | 52 Tabela 52 | 0 | 0 | 0 |
-- | 80 Representante Nacional (antiga) | **2** | 0 | 2 |
-- | 82 Distribuidor Nacional (antiga) | **1** | 0 | 1 |
-- | 8728 Representante Nacional 2026 | 18 | 136 | 12 |
-- | 8729 Distribuidor Nacional 2026 | 17 | 132 | 19 |
-- | 8744 Rio de Janeiro 2026 | 0 | **148** | 0 |
-- | 8745 Representante Negociação Especial 2026 | 0 | **149** | 0 |
--
-- As três primeiras são sobra da saída do Proxis: ninguém aponta para elas e
-- elas não precificam nada. Existiam só para ocupar linha no seletor.
--
-- ## ⚠️ Apaga pela REGRA, e não pela lista `(40, 41, 52)`
--
-- Escrever os três números seria mais curto e mentiria sobre o critério: quem
-- lesse daqui a um ano não saberia se `41` foi apagada por estar vazia ou por
-- alguém não gostar dela. Com a regra escrita, o arquivo continua verdadeiro se
-- rodar de novo — e não apaga nada que tenha ganhado uso nesse meio-tempo.
--
-- Isto também torna a migration **idempotente**: rodar duas vezes apaga zero na
-- segunda.
--
-- ## O que NÃO é apagado, e por quê
--
-- **80 e 82** ("antiga") não têm preço, mas têm **3 contas apontando** e 3
-- pedidos feitos por elas. Apagar a linha deixaria esses perfis com um
-- `proxis_tpr_id` órfão — apontando para um número que não existe mais. Elas não
-- estão vazias; estão **inúteis**, que é outra coisa e pede outra decisão
-- (mudar essas contas de tabela primeiro, em Clientes).
--
-- **8744 e 8745** não têm conta, mas têm 297 preços carregados. Apagar jogaria
-- fora um trabalho de precificação que alguém fez e ainda não atribuiu.
--
-- Nenhuma `foreign key` aponta para `clinic+b2b_price_tables` (conferido), então
-- a exclusão é uma remoção de linha simples — sem cascata escondida.

begin;

-- Registro do que sai, no log da migration. Sem isto, uma execução que apaga
-- mais do que se esperava passa despercebida.
do $$
declare
  alvo record;
  total int := 0;
begin
  for alvo in
    select t.tpr_id, t.name
      from public."clinic+b2b_price_tables" t
     where not exists (
       select 1 from public."clinic+b2b_customer_profiles" p where p.proxis_tpr_id = t.tpr_id
     )
       and not exists (
       select 1 from public."clinic+b2b_customer_price_overrides" o where o.proxis_tpr_id = t.tpr_id
     )
  loop
    raise notice 'apagando tabela vazia: % (%)', alvo.name, alvo.tpr_id;
    total := total + 1;
  end loop;

  raise notice 'total a apagar: %', total;
end
$$;

delete from public."clinic+b2b_price_tables" t
 where not exists (
   select 1 from public."clinic+b2b_customer_profiles" p where p.proxis_tpr_id = t.tpr_id
 )
   and not exists (
   select 1 from public."clinic+b2b_customer_price_overrides" o where o.proxis_tpr_id = t.tpr_id
 );

commit;
