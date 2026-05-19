-- Código interno do produto (admin e pedidos; não exibir no catálogo)
-- Supabase → SQL Editor → New query → Run

alter table public."Clinic+ - Catálogo Front B2B"
  add column if not exists product_code text;

comment on column public."Clinic+ - Catálogo Front B2B".product_code is
  'Código interno para pedidos/exportação. Não exibir no catálogo B2B.';

-- Após executar: Settings → API → Reload schema (ou aguarde ~1 min)
