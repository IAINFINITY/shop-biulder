CREATE TABLE IF NOT EXISTS public.customer_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (char_length(name) >= 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage customer types" ON public.customer_types
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'));

CREATE POLICY "Public read customer types" ON public.customer_types
  FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.customer_types (name) VALUES
  ('cliente'),
  ('lojista'),
  ('distribuidor')
ON CONFLICT (name) DO NOTHING;
