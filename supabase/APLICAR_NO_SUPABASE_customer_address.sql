-- Endereço no cadastro B2B e nos pedidos (aplicar no SQL Editor se ainda não rodou a migration)

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS address_cep TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_street TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_complement TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_ibge TEXT NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_address_cep TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_street TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_complement TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_neighborhood TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_address_ibge TEXT NOT NULL DEFAULT '';

-- Depois execute o restante de: supabase/migrations/20260605120000_customer_address.sql
