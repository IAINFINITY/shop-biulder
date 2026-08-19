-- Autoria de avaliacao: cada um enxerga a propria, e so a propria.
--
-- ## O que estava aberto
--
-- A migration `20260807200000` fechou o `user_id` das avaliacoes para `anon`,
-- derrubando o grant de tabela e reconcedendo coluna a coluna. Ficou pela
-- metade, em dois pontos:
--
-- 1. **`authenticated` nunca foi tocado.** O grant de tabela da linha 655 de
--    `20260804120000_clinic_b2b_rls_policies.sql` continua de pe, e a policy de
--    leitura e `using (true)`. Qualquer cliente logado pedia
--    `/rest/v1/clinic+b2b_product_reviews?select=user_id,product_id,rating` e
--    recebia a autoria de todas as avaliacoes do site.
--
-- 2. **A RPC passava por cima de tudo.** `get_product_reviews` e `security
--    definer`, entao privilegio de coluna nao a alcanca — e ela devolve
--    `user_id` na assinatura. Fechar a tabela sem mexer nela seria trancar a
--    porta e deixar a janela aberta.
--
-- ## Por que o `user_id` nao pode simplesmente sair da RPC
--
-- A pagina do produto usa `review.user_id === user.id` para decidir entre
-- "Avaliar este produto" e "Editar minha avaliacao" (`ProductDetails.tsx`).
-- Remover a coluna quebraria esse botao e exigiria mudanca no front.
--
-- A saida mantem a assinatura: o `user_id` volta preenchido **so quando e o de
-- quem esta perguntando**, e `null` para todos os outros. A comparacao do front
-- continua valendo sem uma linha alterada — `null` nunca e igual ao id de
-- ninguem — e a autoria alheia deixa de sair do banco.
--
-- ## O que esta migration NAO resolve
--
-- `user_name` continua saindo: a RPC junta `customer_profiles` e devolve o nome
-- do cadastro, que a tela mostra ao lado da avaliacao. Isso e recurso de
-- produto, visivel e intencional — nao vaza nada que a interface ja nao mostre.
-- Mas e o nome real de quem cadastrou a empresa, exposto a todo cliente logado,
-- e por isso precisa aparecer no aviso de privacidade (art. 9 da LGPD) ou virar
-- um nome de exibicao. Decisao de negocio, registrada aqui de proposito para
-- nao se perder.

-- ---------------------------------------------------------------------------
-- 1. Fecha o `user_id` para `authenticated`, no nivel de coluna.
-- ---------------------------------------------------------------------------
--
-- Mesmo caminho da correcao de `anon`: um `revoke select (coluna)` nao subtrai
-- de um grant de tabela, entao o grant de tabela cai e a concessao volta coluna
-- a coluna. Nao se mexe em INSERT/UPDATE/DELETE, que sao grants separados e
-- continuam necessarios para a pessoa manter a propria avaliacao.

revoke select on table "clinic+b2b_product_reviews" from authenticated;

grant select (
  id,
  product_id,
  rating,
  title,
  comment,
  created_at,
  updated_at,
  tags,
  admin_response,
  admin_responded_at
) on table "clinic+b2b_product_reviews" to authenticated;

-- ---------------------------------------------------------------------------
-- 2. A RPC devolve autoria so para o dono.
-- ---------------------------------------------------------------------------
--
-- `auth.uid()` continua valendo dentro de `security definer`: ele le a claim do
-- JWT da requisicao, que e estado da sessao, nao privilegio do papel executor.
-- `(select auth.uid())` em vez da chamada direta pelo mesmo motivo das policies
-- deste projeto — o planejador avalia uma vez, e nao por linha.

create or replace function public.get_product_reviews(
  p_product_id uuid,
  p_page integer default 1,
  p_page_size integer default 5
)
returns table (
  id uuid,
  product_id uuid,
  user_id uuid,
  rating smallint,
  title text,
  comment text,
  tags text[],
  admin_response text,
  admin_responded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  user_name text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_offset integer;
  v_uid uuid := (select auth.uid());
begin
  v_offset := (p_page - 1) * p_page_size;

  return query
  select
    r.id,
    r.product_id,
    -- A unica linha que muda de comportamento nesta funcao.
    case when r.user_id = v_uid then r.user_id else null end as user_id,
    r.rating,
    r.title,
    r.comment,
    r.tags,
    r.admin_response,
    r.admin_responded_at,
    r.created_at,
    r.updated_at,
    coalesce(p.name, 'Usuario') as user_name
  from public."clinic+b2b_product_reviews" r
  left join public."clinic+b2b_customer_profiles" p on p.user_id = r.user_id
  where r.product_id = p_product_id
  order by r.created_at desc
  limit p_page_size
  offset v_offset;
end;
$$;

revoke all on function public.get_product_reviews(uuid, integer, integer) from public;
grant execute on function public.get_product_reviews(uuid, integer, integer) to authenticated;

comment on function public.get_product_reviews(uuid, integer, integer) is
  'Avaliacoes de um produto. Devolve user_id apenas quando e do proprio chamador: a pagina precisa dele para saber se ja avaliou, e ninguem precisa da autoria alheia.';
