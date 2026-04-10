-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_company TEXT NOT NULL,
  customer_cnpj TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NOVO CARRINHO',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS is disabled for this table to allow public insertions
-- TODO: Implement proper RLS policies in future
-- ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX orders_created_at_idx ON public.orders (created_at DESC);
