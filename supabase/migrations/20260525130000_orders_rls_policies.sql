-- Enable RLS on orders table (was previously disabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon + authenticated) to INSERT orders (checkout needs this)
CREATE POLICY "Anyone can insert orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Only admins can update orders
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete orders
CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
