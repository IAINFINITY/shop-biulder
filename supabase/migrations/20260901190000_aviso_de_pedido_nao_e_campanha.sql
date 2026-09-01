-- Aviso de pedido não é campanha, e o painel não deve poder editá-lo.
--
-- ## O que estava errado
--
-- A tela "Campanhas e avisos do catálogo" listava, como se fossem campanhas,
-- os avisos automáticos de pedido de um cliente — "Seu pedido foi concluído",
-- com botão de Editar e de Excluir ao lado.
--
-- A causa foi uma decisão minha, registrada em `20260901150000`: reusar a
-- tabela de campanhas para os avisos de pedido, "porque ela já entrega aviso
-- para uma conta só e já tem tela". O raciocínio ignorou que **ter tela** era
-- justamente o problema: a tela é um CRUD, e um aviso gerado por gatilho não é
-- conteúdo que alguém escreve.
--
-- ## O que muda, e o que não muda
--
-- A tabela continua uma só, com a coluna `tipo` separando as duas naturezas.
-- Duas tabelas dariam o mesmo resultado visível e custariam uma segunda caixa
-- de leituras — `clinic+b2b_catalog_notification_reads` guarda `notification_id`
-- e não saberia de qual origem ele veio.
--
-- O que muda é **quem pode mexer em quê**. As policies internas passam a valer
-- só para `tipo = 'campanha'`:
--
-- - o painel enxerga e administra campanhas;
-- - o aviso de pedido é escrito pelo gatilho (`security definer`, passa por
--   cima da RLS) e lido pelo dono, pela policy pública.
--
-- ⚠️ A partir daqui **ninguém edita ou apaga um aviso de pedido pela tela** —
-- nem por engano, nem de propósito. Ele é o registro de um fato: o pedido
-- mudou de estado naquele instante. Corrigir a redação de um aviso já entregue
-- seria reescrever o que a pessoa leu.
--
-- Isso é intencional e tem um preço: limpar aviso de pedido ruim exige SQL.
-- Achei o preço menor que o de deixar um botão de Excluir ao lado do aviso de
-- um cliente numa tela de campanhas.
--
-- ## A restrição de leitura também fecha o vazamento de 01/09
--
-- A policy interna de SELECT não olhava o alvo, e policies se somam com OU: o
-- resultado é que toda conta com papel interno lia os avisos pessoais de todos
-- os clientes. A consulta do cliente passou a filtrar (commit `150531c`), mas
-- filtro de consulta é acordo entre programadores. Restringindo a policy a
-- `tipo = 'campanha'`, a porta deixa de existir.

-- ---------------------------------------------------------------------------
-- As quatro policies internas passam a valer só para campanha
-- ---------------------------------------------------------------------------

drop policy if exists "Clinic B2B internal read notifications"
  on public."clinic+b2b_catalog_notifications";

create policy "Clinic B2B internal read notifications"
  on public."clinic+b2b_catalog_notifications"
  for select to authenticated
  using (clinic_b2b_is_internal_staff() and tipo = 'campanha');

drop policy if exists "Clinic B2B internal insert notifications"
  on public."clinic+b2b_catalog_notifications";

create policy "Clinic B2B internal insert notifications"
  on public."clinic+b2b_catalog_notifications"
  for insert to authenticated
  with check (clinic_b2b_is_internal_staff() and tipo = 'campanha');

drop policy if exists "Clinic B2B internal update notifications"
  on public."clinic+b2b_catalog_notifications";

-- `using` e `with check` juntos: sem o `with check`, daria para pegar uma
-- campanha e transformá-la em `tipo = 'pedido_concluido'`, forjando um aviso de
-- sistema pela tela.
create policy "Clinic B2B internal update notifications"
  on public."clinic+b2b_catalog_notifications"
  for update to authenticated
  using (clinic_b2b_is_internal_staff() and tipo = 'campanha')
  with check (clinic_b2b_is_internal_staff() and tipo = 'campanha');

drop policy if exists "Clinic B2B internal delete notifications"
  on public."clinic+b2b_catalog_notifications";

create policy "Clinic B2B internal delete notifications"
  on public."clinic+b2b_catalog_notifications"
  for delete to authenticated
  using (clinic_b2b_is_internal_staff() and tipo = 'campanha');

-- ---------------------------------------------------------------------------
-- Os cinco avisos de teste
-- ---------------------------------------------------------------------------
--
-- São do pedido fictício de 01/09, já apagado. Saem junto com as leituras, que
-- não têm foreign key para limpá-las sozinhas.

delete from public."clinic+b2b_catalog_notification_reads"
 where notification_id in (
   select id from public."clinic+b2b_catalog_notifications"
    where tipo <> 'campanha'
      and target_user_id in (select id from auth.users where email = 'franciscoaneto13@gmail.com')
 );

delete from public."clinic+b2b_catalog_notifications"
 where tipo <> 'campanha'
   and target_user_id in (select id from auth.users where email = 'franciscoaneto13@gmail.com');
