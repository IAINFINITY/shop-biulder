ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS submission_key UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS orders_submission_key_key
  ON public.orders (submission_key);
