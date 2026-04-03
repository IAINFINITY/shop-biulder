
-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('Chá', 'Cápsula', 'Solúvel')),
  family TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can read active products
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT
USING (active = true);

-- Create admin role
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admins can do everything with products
CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Product images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default products
INSERT INTO public.products (name, description, type, family) VALUES
  ('Chá Detox Premium', 'Blend exclusivo com ervas selecionadas para desintoxicação natural do organismo.', 'Chá', 'Detox'),
  ('Chá Calmante Noturno', 'Combinação de camomila, maracujá e erva-cidreira para noites tranquilas.', 'Chá', 'Bem-estar'),
  ('Chá Energizante Matinal', 'Chá verde com gengibre e limão para começar o dia com energia.', 'Chá', 'Energia'),
  ('Cápsula Imunidade Plus', 'Complexo vitamínico com zinco, vitamina C e própolis para fortalecer a imunidade.', 'Cápsula', 'Imunidade'),
  ('Cápsula Colágeno Hidrolisado', 'Colágeno tipo I e III para pele, cabelos e unhas saudáveis.', 'Cápsula', 'Beleza'),
  ('Cápsula Ômega 3 Concentrado', 'Óleo de peixe ultrapurificado com alta concentração de EPA e DHA.', 'Cápsula', 'Bem-estar'),
  ('Solúvel Proteína Vegetal', 'Mix proteico à base de ervilha e arroz com sabor de baunilha.', 'Solúvel', 'Nutrição'),
  ('Solúvel Fibras Prebióticas', 'Blend de fibras solúveis para equilíbrio da flora intestinal.', 'Solúvel', 'Digestão'),
  ('Chá Emagrecedor Turbo', 'Chá termogênico com hibisco, canela e gengibre.', 'Chá', 'Emagrecimento'),
  ('Cápsula Magnésio Quelato', 'Magnésio de alta absorção para músculos e sistema nervoso.', 'Cápsula', 'Bem-estar'),
  ('Solúvel Vitamina C Efervescente', '1000mg de vitamina C com sabor laranja, fácil dissolução.', 'Solúvel', 'Imunidade'),
  ('Cápsula Probiótico 10 Bi', '10 bilhões de UFC com 5 cepas selecionadas para saúde intestinal.', 'Cápsula', 'Digestão');
