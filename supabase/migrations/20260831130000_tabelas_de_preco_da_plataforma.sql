-- As tabelas de preço deixam de ser espelho do Proxis e passam a ser da casa.
--
-- ## O que muda, e o que **não** muda
--
-- Os 565 preços das quatro tabelas já estão neste banco desde as importações —
-- o Proxis nunca foi consultado para exibir preço, só para importar. Nada de
-- dado se move aqui.
--
-- O que muda é o estado delas: eram espelho (só leitura, porque a API do
-- ProManager lê preço mas não grava) e passam a ser editáveis no painel, como a
-- tabela de funcionário já é desde 25/08.
--
-- ## Os números não mudam. Isto é regra, não preferência.
--
-- O TXT do FOCCO grava o número da tabela no campo `tabVenda`
-- (`src/lib/proxisImportExport.ts`). O FOCCO **continua** — foi confirmado pelo
-- responsável em 31/08/2026, junto com o PDF.
--
-- Renumerar 8728/8729/8744/8745 para 1/2/3/4 quebraria o arquivo que o pessoal
-- do ERP consome, e quebraria **em silêncio**: o TXT continuaria sendo gerado,
-- só que com a tabela errada dentro. Por isso a única coisa que esta migration
-- toca é o nome.
--
-- ## Os nomes
--
-- Vinham como "Tabela Proxis #8728" — placeholder gerado por
-- `sync_customer_proxis_link` quando o TPR aparecia pela primeira vez. Os nomes
-- de verdade estavam só do lado do ERP, na tela de importação. Com o ERP fora,
-- eles se perderiam: ficam gravados aqui.

update public."clinic+b2b_price_tables" set name = 'Representante Nacional 2026' where tpr_id = 8728;
update public."clinic+b2b_price_tables" set name = 'Distribuidor Nacional 2026' where tpr_id = 8729;
update public."clinic+b2b_price_tables" set name = 'Rio de Janeiro 2026' where tpr_id = 8744;
update public."clinic+b2b_price_tables" set name = 'Representante Negociação Especial 2026' where tpr_id = 8745;
update public."clinic+b2b_price_tables" set name = 'Representante Nacional (antiga)' where tpr_id = 80;
update public."clinic+b2b_price_tables" set name = 'Distribuidor Nacional (antiga)' where tpr_id = 82;

-- As tabelas que existem em `customer_price_overrides` mas nunca ganharam
-- registro aqui. Sem isto elas apareceriam no painel como "Tabela 8744", porque
-- o nome vinha do ERP a cada carregamento e o ERP não responde mais.
insert into public."clinic+b2b_price_tables" (tpr_id, name, active)
select distinct o.proxis_tpr_id,
       'Tabela ' || o.proxis_tpr_id,
       true
  from public."clinic+b2b_customer_price_overrides" o
 where o.proxis_tpr_id is not null
   and not exists (select 1 from public."clinic+b2b_price_tables" t where t.tpr_id = o.proxis_tpr_id)
on conflict (tpr_id) do nothing;

-- ---------------------------------------------------------------------------
-- A sincronização com o ERP para de existir
-- ---------------------------------------------------------------------------
--
-- `sync_customer_proxis_link` gravava `proxis_pes_id` e `proxis_tpr_id` no perfil
-- a partir do que o ERP respondia sobre o CNPJ. Era chamada em seis lugares —
-- login, checkout, conta e painel.
--
-- Com o ERP fora, ninguém mais a chama. Mas ela **não é apagada agora**: se
-- algum caminho esquecido ainda chamar, o erro seria "function does not exist"
-- no meio de um login. Ela passa a não fazer nada e devolve sem escrever.
--
-- A remoção fica para a Fase 4, depois de a Fase 3 estar no ar e o log limpo.
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
begin
  -- Sem efeito desde 31/08/2026: não há ERP de onde vir o vínculo, e a tabela de
  -- preço do cliente passou a ser mantida no painel. Escrever aqui apagaria a
  -- classificação feita à mão na primeira chamada esquecida.
  return;
end;
$$;

comment on function public.sync_customer_proxis_link(integer, integer, boolean, uuid) is
  'Desativada em 31/08/2026 com a saída do Proxis. Mantida só para não quebrar chamador esquecido; remover na Fase 4.';
