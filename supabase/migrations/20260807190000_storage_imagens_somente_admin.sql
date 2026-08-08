-- Só admin escreve no bucket de imagens de produto.
--
-- ## O problema
--
-- O repositório tem DOIS arquivos que definem estas políticas, com regras opostas:
--
--   supabase/APLICAR_NO_SUPABASE_storage_product_images.sql
--     → "Authenticated upload/update/delete product images"
--       to authenticated, with check (bucket_id = 'product-images')
--       — sem nenhuma checagem de papel. O comentário no arquivo diz
--         "admin já passa pelo login do painel", o que confunde autenticação
--         com autorização: qualquer cliente logado também é `authenticated`.
--
--   supabase/APLICAR_NO_SUPABASE_security_fix.sql
--     → "Admins can upload/update/delete product images"
--       to authenticated, with check (... AND public.has_role(auth.uid(), 'admin'))
--
-- Como os dois são de aplicação manual, o repositório não diz qual está valendo
-- em produção. Se for o primeiro, **qualquer cliente com conta pode enviar,
-- sobrescrever e apagar qualquer imagem do catálogo** — troca de foto de produto,
-- apagão da vitrine inteira, ou upload de arquivo próprio hospedado no domínio do
-- Supabase do projeto.
--
-- Isso é escalonamento vertical de privilégio: a §16 exige decisão por "ação,
-- função, objeto, campo, tenant" e regras "deny-by-default e least privilege".
--
-- ## Por que esta migration é segura nos dois cenários
--
-- Ela derruba as duas famílias de política e recria só a versão com `has_role`.
-- Se produção já estiver correta, o resultado é idêntico ao que já existe. Se
-- estiver permissiva, fecha. Rodar duas vezes não muda nada.

-- Leitura pública continua: a vitrine precisa das imagens sem login.
drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Derruba a família permissiva.
drop policy if exists "Authenticated upload product images" on storage.objects;
drop policy if exists "Authenticated update product images" on storage.objects;
drop policy if exists "Authenticated delete product images" on storage.objects;

-- E recria a família correta, do zero, para não depender de qual estava aplicada.
drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.has_role(auth.uid(), 'admin')
  )
  with check (
    bucket_id = 'product-images'
    and public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.has_role(auth.uid(), 'admin')
  );
