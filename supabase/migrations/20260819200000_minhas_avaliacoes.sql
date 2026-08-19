-- "Quais avaliações eu escrevi?"
--
-- ## Por que precisa de funcao propria
--
-- A migration `20260819120000` revogou o `select` da coluna `user_id` para
-- `authenticated`, e isso tem uma consequencia que so aparece agora: no Postgres,
-- usar uma coluna no `where` exige privilegio de leitura sobre ela. Entao
-- `select ... where user_id = auth.uid()` passou a ser recusado — inclusive para
-- a propria pessoa perguntando pelas proprias avaliacoes.
--
-- Nada quebrou com isso, porque nenhuma tela filtrava assim. Mas a exportacao de
-- dados do titular (art. 18, V) precisa exatamente disso, e nao daria.
--
-- Abrir a coluna de novo desfaria a correcao. A saida e esta funcao: `security
-- definer`, entao le a coluna com o privilegio do dono, e devolve **apenas** as
-- linhas de quem chamou. O escopo esta preso no `where`, nao em parametro — quem
-- chama nao tem como pedir as avaliacoes de outra pessoa.

create or replace function public.clinic_b2b_minhas_avaliacoes()
returns table (
  id uuid,
  product_id uuid,
  rating smallint,
  title text,
  comment text,
  tags text[],
  admin_response text,
  admin_responded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;

  return query
  select
    r.id,
    r.product_id,
    r.rating,
    r.title,
    r.comment,
    r.tags,
    r.admin_response,
    r.admin_responded_at,
    r.created_at,
    r.updated_at
  from public."clinic+b2b_product_reviews" r
  where r.user_id = v_uid
  order by r.created_at desc;
end;
$$;

revoke all on function public.clinic_b2b_minhas_avaliacoes() from public;
grant execute on function public.clinic_b2b_minhas_avaliacoes() to authenticated;

comment on function public.clinic_b2b_minhas_avaliacoes() is
  'Avaliacoes de quem chama. Sem parametro de propósito: o escopo e o proprio auth.uid(), e nao ha como pedir as de outra pessoa.';
