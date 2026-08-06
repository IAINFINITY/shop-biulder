-- Lista de recompra do cliente.
--
-- Antes os favoritos viviam so no localStorage. Duas consequencias: nao seguiam
-- o cliente entre celular e desktop, e nao eram do cliente e sim do navegador —
-- um funcionario favoritava, saia, e o proximo a entrar naquele computador via a
-- lista do anterior, porque o signOut nunca limpava a chave.
--
-- `quantity` esta aqui de proposito. Em B2B a lista nao e desejo, e reposicao: o
-- cliente que sempre pede 2 do mesmo item nao deveria redigitar isso todo mes.
-- E o que separa lista de recompra de wishlist.

create table if not exists public."clinic+b2b_customer_favorites" (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id),
  constraint clinic_b2b_customer_favorites_quantity_check
    check (quantity >= 1 and quantity <= 9999)
);

-- Sem chave estrangeira para o catalogo de proposito: produto sai de linha e
-- volta, e apagar a lista do cliente por causa disso e perda de dado. O front ja
-- ignora id que nao resolve (`resolveProductsByIdOrder`).

-- A lista e lida inteira por usuario, ordenada do mais recente para o mais
-- antigo. O prefixo da PK cobre o filtro; o indice cobre a ordenacao.
create index if not exists clinic_b2b_customer_favorites_user_created_idx
  on public."clinic+b2b_customer_favorites" (user_id, created_at desc);

alter table public."clinic+b2b_customer_favorites" enable row level security;

-- Estritamente do dono, sem excecao para equipe interna.
--
-- As outras tabelas do projeto abrem para `clinic_b2b_is_internal_staff()`
-- porque o admin precisa operar pedido e cadastro. Aqui nao precisa: ninguem no
-- painel administra a lista de recompra de ninguem, e abrir seria expor o que o
-- cliente pretende comprar sem que isso sirva para nada.

drop policy if exists "favoritos: dono le" on public."clinic+b2b_customer_favorites";
create policy "favoritos: dono le"
  on public."clinic+b2b_customer_favorites"
  for select
  using (auth.uid() = user_id);

drop policy if exists "favoritos: dono insere" on public."clinic+b2b_customer_favorites";
create policy "favoritos: dono insere"
  on public."clinic+b2b_customer_favorites"
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "favoritos: dono atualiza" on public."clinic+b2b_customer_favorites";
create policy "favoritos: dono atualiza"
  on public."clinic+b2b_customer_favorites"
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "favoritos: dono apaga" on public."clinic+b2b_customer_favorites";
create policy "favoritos: dono apaga"
  on public."clinic+b2b_customer_favorites"
  for delete
  using (auth.uid() = user_id);
