-- Execute no SQL Editor do Supabase (exportação .txt Proxis no painel admin)
-- Arquivo completo também em: supabase/migrations/20260528140000_proxis_import_id.sql

CREATE SEQUENCE IF NOT EXISTS public.proxis_import_id_seq START WITH 1;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS proxis_import_id INTEGER UNIQUE;

CREATE OR REPLACE FUNCTION public.allocate_proxis_import_id(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id INTEGER;
  new_id INTEGER;
BEGIN
  SELECT proxis_import_id INTO existing_id
  FROM public.orders
  WHERE id = p_order_id;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  new_id := nextval('public.proxis_import_id_seq');
  UPDATE public.orders
  SET proxis_import_id = new_id
  WHERE id = p_order_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_proxis_import_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_proxis_import_id(UUID) TO authenticated;

-- Se já existirem IDs no Proxis, ajuste o próximo número, por exemplo:
-- SELECT setval('public.proxis_import_id_seq', 100, false);
