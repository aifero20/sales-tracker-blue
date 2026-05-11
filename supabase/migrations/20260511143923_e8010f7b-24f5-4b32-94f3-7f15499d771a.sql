
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sales');

-- Updated-at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  sales_code TEXT UNIQUE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, sales_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'sales_code'
  );
  -- Default role: sales (admin assigned manually first time)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'sales'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cigarette products
CREATE TABLE public.cigarette_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_per_pcs INTEGER NOT NULL CHECK (price_per_pcs >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cigarette_products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.cigarette_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sales transactions
CREATE TABLE public.sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sales_code TEXT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_time TIME NOT NULL DEFAULT CURRENT_TIME,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  photo_url TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tx_sales_user ON public.sales_transactions(sales_user_id);
CREATE INDEX idx_tx_date ON public.sales_transactions(transaction_date);

-- Transaction items
CREATE TABLE public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.sales_transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.cigarette_products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_items_tx ON public.transaction_items(transaction_id);

-- App settings (singleton)
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  google_spreadsheet_id TEXT,
  google_drive_folder_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (id) VALUES (1);

-- =================== RLS POLICIES ===================

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- products
CREATE POLICY "Authenticated view products" ON public.cigarette_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage products" ON public.cigarette_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- stores
CREATE POLICY "Authenticated view stores" ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins update stores" ON public.stores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete stores" ON public.stores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sales_transactions
CREATE POLICY "Sales view own transactions" ON public.sales_transactions FOR SELECT TO authenticated USING (auth.uid() = sales_user_id);
CREATE POLICY "Admins view all transactions" ON public.sales_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales insert own transactions" ON public.sales_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = sales_user_id);
CREATE POLICY "Admins delete transactions" ON public.sales_transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- transaction_items
CREATE POLICY "Sales view own items" ON public.transaction_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sales_transactions t WHERE t.id = transaction_id AND t.sales_user_id = auth.uid())
);
CREATE POLICY "Admins view all items" ON public.transaction_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales insert items for own tx" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.sales_transactions t WHERE t.id = transaction_id AND t.sales_user_id = auth.uid())
);

-- app_settings
CREATE POLICY "Authenticated view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed products
INSERT INTO public.cigarette_products (name, price_per_pcs, sort_order) VALUES
  ('Daun12', 6800, 1),
  ('Daun16', 8800, 2),
  ('Refill12', 8800, 3),
  ('Sigara12', 7000, 4),
  ('Sultan16', 8000, 5),
  ('Inggil16', 9000, 6),
  ('Starlet16', 9000, 7),
  ('Angsal16', 8000, 8),
  ('Berry16', 9000, 9),
  ('Korek', 1200, 10);
