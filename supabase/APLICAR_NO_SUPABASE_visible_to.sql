-- Adiciona a coluna visible_to nas tabelas de produto e banner
-- Permite restringir a exibição por tipo de cliente (cliente, lojista, distribuidor, etc.)
-- visible_to = NULL significa "visível para todos" (compatível com registros existentes)
-- visible_to = ARRAY['cliente', 'lojista'] significa "visível apenas para esses tipos"

ALTER TABLE "Clinic+ - Catálogo Front B2B"
ADD COLUMN IF NOT EXISTS visible_to text[] DEFAULT NULL;

ALTER TABLE catalog_banners
ADD COLUMN IF NOT EXISTS visible_to text[] DEFAULT NULL;
