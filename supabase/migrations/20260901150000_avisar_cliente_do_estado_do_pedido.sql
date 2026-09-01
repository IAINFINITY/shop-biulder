-- Avisar o cliente quando o pedido dele muda de estado.
--
-- ## O pedido
--
-- "a parte de notificação de catálogo, eu acho que dá pra gente mudar pra
-- transformar isso em notificações gerais, em que eu seria informado quando um
-- pedido que eu fiz foi enviado pro time, se o pedido foi concluído, cancelado,
-- etc."
--
-- ## O buraco que isso fecha
--
-- É a reclamação de 31/08, por escrito:
--
--   > "fiz um pedido dia 28 de agosto (…) porém eu não consigo acompanhar a
--   >  evolução, também não recebi nenhum e-mail com informações."
--
-- A linha do tempo (`clinic+b2b_order_events`) resolveu o "não consigo
-- acompanhar" — mas só para quem **entra** na conta e vai olhar. Quem não entra
-- continua sem saber. Isto é o empurrão que faltava.
--
-- ## ⚠️ Reusa `catalog_notifications`, e é por isso que a tabela deixa de ser
-- "do catálogo"
--
-- Ela já entrega aviso para uma conta só (`target_user_id`) e já tem tela. Uma
-- tabela nova daria o mesmo resultado com mais uma caixa de entrada para o
-- cliente aprender. O que muda é o significado: ela deixa de ser "campanhas do
-- catálogo" e passa a ser "avisos da sua conta" — campanha é um dos tipos.
--
-- ## A frase é a MESMA que a conta mostra
--
-- O texto sai de `EXPLICACAO_PARA_O_CLIENTE`, o mesmo dicionário que a tela de
-- detalhe do pedido usa e que o admin vê antes de confirmar a mudança. Três
-- lugares, um texto: papel, tela e aviso contando a mesma história.
--
-- ⚠️ Duplicado aqui em SQL de propósito — a função é `security definer` e roda
-- no banco, longe do TypeScript. **Se a frase mudar lá, muda aqui.**

create or replace function public.avisar_cliente_do_estado_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destinatario uuid;
  titulo text;
  corpo text;
  estado text := lower(coalesce(new.status, ''));
begin
  -- Só quando o estado muda de verdade. Corrigir um endereço não é evento, e
  -- avisar por isso ensina o cliente a ignorar o sino.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Quem recebe: o dono do CNPJ do pedido. O pedido não guarda `user_id` — ele
  -- pode ter sido feito sem conta e reivindicado depois pelo CNPJ, que é a
  -- mesma regra de `clinic_b2b_can_view_order`.
  select p.user_id into destinatario
    from public."clinic+b2b_customer_profiles" p
   where p.cnpj = new.customer_cnpj
   limit 1;

  if destinatario is null then
    return new;
  end if;

  -- ⚠️ Os mesmos seis estados de `statusDoPedido.ts`, na mesma ordem de
  -- casamento: `cancel` primeiro, `pagament` sozinho (e não `aguardando`
  -- solto, que pegava "aguardando retirada"), e só então os demais.
  if estado like '%cancel%' then
    titulo := 'Seu pedido foi cancelado';
    corpo := 'Seu pedido foi cancelado. Se não foi você quem pediu isso, fale com a gente pelo chat.';
  elsif estado like '%pagament%' then
    titulo := 'Seu pedido aguarda pagamento';
    corpo := 'Seu pedido está pronto e aguarda o pagamento. Nosso time entra em contato para combinar a forma e as condições — o pagamento não é feito pelo site.';
  elsif estado like '%enviad%' or estado like '%despach%' then
    titulo := 'Seu pedido foi enviado';
    corpo := 'Seu pedido saiu para entrega. Em breve você recebe.';
  elsif estado like '%conclu%' or estado like '%entreg%' or estado like '%atendid%' then
    titulo := 'Seu pedido foi concluído';
    corpo := 'Seu pedido foi concluído. Obrigado pela compra!';
  elsif estado like '%andamento%' or estado like '%process%' then
    titulo := 'Seu pedido está em andamento';
    corpo := 'Nosso time já está preparando o seu pedido.';
  else
    titulo := 'Recebemos o seu pedido';
    corpo := 'Recebemos seu pedido. Nosso time vai conferir os itens e entrar em contato.';
  end if;

  insert into public."clinic+b2b_catalog_notifications"
    (title, summary, body, cta_label, cta_url, target_user_id, active, priority, ends_at)
  values (
    titulo,
    'Atualização do seu pedido.',
    corpo,
    'Ver meus pedidos',
    '/conta?section=pedidos',
    destinatario,
    true,
    -- Acima de campanha: o estado de um pedido é sobre dinheiro que a pessoa
    -- já gastou; campanha é convite.
    2,
    -- Some sozinho depois de 60 dias. Aviso de pedido antigo acumulado vira
    -- entulho, e entulho ensina a ignorar a sineta.
    now() + interval '60 days'
  );

  return new;
end;
$$;

drop trigger if exists avisar_cliente_do_estado_do_pedido on public."clinic+b2b_orders";
create trigger avisar_cliente_do_estado_do_pedido
  after update of status on public."clinic+b2b_orders"
  for each row execute function public.avisar_cliente_do_estado_do_pedido();

comment on table public."clinic+b2b_catalog_notifications" is
  'Avisos da conta do cliente: campanhas do catálogo E atualizações de pedido/atendimento. O nome "catalog" é histórico — ver a migration 20260901150000.';
