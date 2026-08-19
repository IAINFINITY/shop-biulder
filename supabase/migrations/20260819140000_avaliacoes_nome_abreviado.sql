-- Avaliacao mostra "Felipe F.", nao o nome inteiro do cadastro.
--
-- ## O que mudou de fato
--
-- `get_product_reviews` devolvia `p.name` cru — o nome completo de quem cadastrou
-- a empresa, ao lado de cada avaliacao, visivel a todo cliente logado. Nao era
-- vazamento escondido: a pagina sempre mostrou. Era exposicao maior do que a
-- finalidade pedia.
--
-- A finalidade de exibir o autor e dar credibilidade a avaliacao. "Felipe F."
-- entrega isso igual. O nome inteiro e pesquisavel e liga a avaliacao a uma
-- pessoa fora daqui; a forma abreviada, nao. E o art. 6, III da LGPD em uma
-- frase: so o que a finalidade exige.
--
-- ## Por que no banco, e nao na tela
--
-- Abreviar no front deixaria o nome completo viajar ate o navegador — visivel no
-- inspetor, no cache, em qualquer extensao. Minimizar so vale quando o dado nao
-- sai. Aqui ele nao sai.
--
-- O custo e conhecido e aceito: esta regra fica em SQL, fora do `src/lib` que o
-- projeto usa para logica pura testavel. A validacao acontece contra o banco,
-- como a da migration `20260819120000`.
--
-- ## O que continua igual
--
-- Quem escreveu continua reconhecendo a propria avaliacao: isso vem do `user_id`,
-- que a migration anterior ja restringiu ao proprio autor. O nome abreviado e so
-- exibicao.

-- ---------------------------------------------------------------------------
-- Abreviacao, isolada para poder ser conferida sozinha.
-- ---------------------------------------------------------------------------
--
-- "Felipe Fernandes Silva" -> "Felipe S."   (primeiro nome + inicial do ultimo)
-- "Felipe"                 -> "Felipe"      (nome unico nao tem o que abreviar)
-- ""  ou  null             -> "Usuario"     (mesmo padrao que a funcao ja usava)
--
-- `immutable` porque so depende da entrada: deixa o planejador reaproveitar o
-- resultado e permite uso em indice, se um dia precisar.

create or replace function public.clinic_b2b_nome_curto(p_nome text)
returns text
language sql
immutable
as $$
  with limpo as (
    select btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')) as nome
  ),
  partes as (
    select nome, string_to_array(nome, ' ') as pedacos from limpo
  )
  select case
    when nome = '' then 'Usuario'
    when array_length(pedacos, 1) = 1 then nome
    else pedacos[1] || ' ' || upper(left(pedacos[array_length(pedacos, 1)], 1)) || '.'
  end
  from partes;
$$;

comment on function public.clinic_b2b_nome_curto(text) is
  'Nome de exibicao: primeiro nome e inicial do ultimo. Usado nas avaliacoes para nao publicar o nome completo do cadastro.';

-- ---------------------------------------------------------------------------
-- A RPC passa a devolver o nome abreviado.
-- ---------------------------------------------------------------------------

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
    case when r.user_id = v_uid then r.user_id else null end as user_id,
    r.rating,
    r.title,
    r.comment,
    r.tags,
    r.admin_response,
    r.admin_responded_at,
    r.created_at,
    r.updated_at,
    public.clinic_b2b_nome_curto(p.name) as user_name
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
  'Avaliacoes de um produto. Devolve user_id apenas ao proprio autor, e o nome do autor abreviado — nunca o nome completo do cadastro.';
