-- Add average_rating and review_count to products table
alter table public."Clinic+ - Catálogo Front B2B"
  add column if not exists average_rating numeric(3,2) not null default 0,
  add column if not exists review_count integer not null default 0;

-- Add tags and admin_response to product_reviews
alter table public.product_reviews
  add column if not exists tags text[] not null default '{}',
  add column if not exists admin_response text,
  add column if not exists admin_responded_at timestamptz;

-- Trigger function to update product average_rating and review_count
create or replace function public.update_product_rating()
returns trigger
language plpgsql
security definer
as $$
declare
  avg_rating numeric;
  cnt integer;
begin
  select
    coalesce(avg(rating)::numeric(3,2), 0),
    count(*)
  into avg_rating, cnt
  from public.product_reviews
  where product_id = coalesce(new.product_id, old.product_id);

  update public."Clinic+ - Catálogo Front B2B"
  set
    average_rating = avg_rating,
    review_count = cnt
  where id = coalesce(new.product_id, old.product_id);

  return coalesce(new, old);
end;
$$;

create or replace trigger trg_product_reviews_update_rating
  after insert or delete or update of rating
  on public.product_reviews
  for each row
  execute function public.update_product_rating();

-- RPC to fetch reviews with user profile data
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
as $$
declare
  v_offset integer;
begin
  v_offset := (p_page - 1) * p_page_size;

  return query
  select
    r.id,
    r.product_id,
    r.user_id,
    r.rating,
    r.title,
    r.comment,
    r.tags,
    r.admin_response,
    r.admin_responded_at,
    r.created_at,
    r.updated_at,
    coalesce(p.name, 'Usuário') as user_name
  from public.product_reviews r
  left join public.customer_profiles p on p.user_id = r.user_id
  where r.product_id = p_product_id
  order by r.created_at desc
  limit p_page_size
  offset v_offset;
end;
$$;

-- RPC to count reviews for a product
create or replace function public.count_product_reviews(p_product_id uuid)
returns integer
language plpgsql
security definer
stable
as $$
begin
  return (select count(*) from public.product_reviews where product_id = p_product_id);
end;
$$;
