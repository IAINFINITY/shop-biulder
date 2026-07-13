-- Product reviews / ratings
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public."Clinic+ - Catálogo Front B2B"(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  title text,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, user_id)
);

create index if not exists idx_product_reviews_product_id
  on public.product_reviews (product_id);

create index if not exists idx_product_reviews_user_id
  on public.product_reviews (user_id);

-- RLS
alter table public.product_reviews enable row level security;

-- Anyone can read reviews (for product display)
create policy "Product reviews are publicly readable"
  on public.product_reviews for select
  using (true);

-- Authenticated users can insert their own reviews
create policy "Users can insert their own reviews"
  on public.product_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own reviews
create policy "Users can update their own reviews"
  on public.product_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own reviews
create policy "Users can delete their own reviews"
  on public.product_reviews for delete
  to authenticated
  using (auth.uid() = user_id);
