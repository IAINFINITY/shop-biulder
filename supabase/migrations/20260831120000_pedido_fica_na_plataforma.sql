-- O pedido passa a ficar na plataforma. Fim da integração com o Proxis.
--
-- ## O que decidiu isto
--
-- Em 31/08/2026 o responsável pelo ERP confirmou que o Proxis sai de uso no dia
-- seguinte, e que o padrão passa a ser o que já valia para funcionário: o pedido
-- fica aqui, e a saída são os arquivos (TXT do FOCCO, XLSX e PDF), que
-- continuam.
--
-- ## O que muda
--
-- O gatilho `marcar_pedido_de_funcionario` marcava `nao_aplicavel` só quando
-- quem comprava era funcionário. Agora **todo** pedido nasce assim, porque
-- nenhum vai mais a lugar nenhum automaticamente.
--
-- Sem esta migration, todo pedido novo nasceria `pendente` e entraria na fila de
-- reconciliação do painel esperando um envio que nunca vem — a fila encheria com
-- pedidos perfeitos.
--
-- ## Por que o gatilho não é apagado
--
-- Porque vem outro ERP. Quando ele chegar, este é o ponto que decide se o pedido
-- sai ou não da plataforma, e ele já está ligado na tabela certa, no momento
-- certo (antes do insert), lendo o perfil de quem compra. Apagar agora custaria
-- recriar depois.
--
-- O nome fica para a próxima migration da Fase 4, junto com o resto da
-- renomeação — trocar nome de função aqui obrigaria a mexer no `api/` no mesmo
-- passo, e esta fase precisa ser pequena.

create or replace function public.marcar_pedido_de_funcionario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Sem exceção e sem consultar o perfil: nenhum pedido sai da plataforma
  -- sozinho hoje. A consulta que existia aqui ficou sem propósito no instante
  -- em que a resposta passou a ser a mesma para todo mundo.
  new.proxis_status := 'nao_aplicavel';
  return new;
end;
$$;

comment on function public.marcar_pedido_de_funcionario() is
  'Todo pedido nasce nao_aplicavel: desde 31/08/2026 nenhum pedido sai da plataforma automaticamente. O gatilho fica de pé para o ERP que vier depois.';

-- Os pedidos que ficaram pendentes de um envio que não vai mais acontecer.
--
-- Sem isto eles ficariam para sempre na fila de reconciliação do painel,
-- pedindo uma ação que não existe mais. `enviado` e `legado` não são tocados:
-- aqueles chegaram ao ERP de verdade e o registro tem de continuar contando essa
-- história.
update public."clinic+b2b_orders"
   set proxis_status = 'nao_aplicavel'
 where proxis_status is null
    or proxis_status not in ('enviado', 'legado', 'nao_aplicavel');
