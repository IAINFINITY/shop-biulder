# Catálogo Clinic+ (Front B2B)

Projeto de catálogo de produtos com carrinho, WhatsApp e painel administrativo para gerenciar produtos e imagens.

**Principais recursos**
- Catálogo com busca e filtros por Tipo e Família
- Carrinho com observações por item
- Envio do carrinho para WhatsApp com lista de produtos
- Página de detalhes do produto (`/produto/:id`)
- Painel Admin com criação/edição de produtos e upload de imagens
- Tipos de produto configuráveis no Admin (adicionar/excluir)

**Stack**
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Database, Auth, Storage)

**Rodar o projeto**
1. Instalar dependências:
```bash
npm install
```

2. Subir o servidor de desenvolvimento:
```bash
npm run dev
```

Acesse o endereço exibido no terminal (ex: `http://localhost:5173`).

**Variáveis de ambiente**
Crie um `.env` com as chaves do Supabase. Use o modelo em `.env.example`.

Exemplo:
```
VITE_SUPABASE_PROJECT_ID="seu-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-publishable-key"
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
```

**Supabase: tabelas obrigatórias**
Este projeto usa a tabela principal com o nome:

`Clinic+ - Catálogo Front B2B`

Se você quiser mudar o nome, atualize `PRODUCTS_TABLE` em `src/lib/products.ts`.

Estrutura recomendada da tabela de produtos:
```sql
create table public."Clinic+ - Catálogo Front B2B" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  type text not null,
  family text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Supabase: roles de admin**
Tabela para roles:
```sql
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Users can view own roles"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);
```

Função para checar admin:
```sql
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
```

Depois de criar um usuário em **Auth → Users**, atribua admin:
```sql
insert into public.user_roles (user_id, role)
values ('<UUID_DO_USUARIO>', 'admin');
```

**Supabase: Storage de imagens**
Bucket usado: `product-images`

Criar bucket e políticas:
```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict do nothing;

create policy "Anyone can view product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Admins can upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
```

**Supabase: tipos de produto (adicionar/excluir)**
Tabela `product_types` para gerenciar tipos no Admin:
```sql
create table public.product_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.product_types enable row level security;

create policy "Anyone can view product types"
on public.product_types for select
using (true);

create policy "Admins can insert product types"
on public.product_types for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update product types"
on public.product_types for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete product types"
on public.product_types for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));
```

Opcional: popular com tipos iniciais:
```sql
insert into public.product_types (name) values
('Chá'),
('Cápsula'),
('Solúvel')
on conflict (name) do nothing;
```

**Importar produtos do catálogo**
O arquivo com os inserts está em:
`supabase/seed/catalog_products.sql`

Basta colar no SQL Editor e rodar.

**WhatsApp do consultor**
O botão “Enviar ao Consultor” abre o WhatsApp com a lista do carrinho.
Número configurado: `+55 49 9838-0268`.

Arquivo: `src/components/CartDrawer.tsx`

**Página de detalhes do produto**
Rota: `/produto/:id`

Arquivo: `src/pages/ProductDetails.tsx`

**Carrinho**
Os itens do carrinho são salvos no `localStorage`.
Arquivo: `src/lib/products.ts`

**Favicon e título**
- Título: `Catálogo Clinic+`
- Favicon: `public/favicon.svg`
Arquivo: `index.html`

**Dicas rápidas**
- Depois de alterar o `.env`, reinicie o `npm run dev`.
- Se o upload de imagem falhar, confira as políticas do Storage e se o usuário é admin.

