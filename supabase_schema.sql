-- =============================================
-- SCHEMA UNTUK SISTEM INSPEKSI BARANG
-- Jalankan di Supabase SQL Editor
-- =============================================

-- 1. Tabel roles
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

-- 2. Tabel profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role_id uuid REFERENCES public.roles(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. Tabel inspeksi_barang (sudah ada, pastikan cocok)
CREATE TABLE IF NOT EXISTS public.inspeksi_barang (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_barang text NOT NULL,
  waktu_masuk timestamp with time zone NOT NULL DEFAULT now(),
  logam boolean NOT NULL DEFAULT false,
  organik boolean NOT NULL DEFAULT false,
  cairan boolean NOT NULL DEFAULT false,
  sintetis boolean NOT NULL DEFAULT false,
  foto_url text,
  raw_stats jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  catatan text,
  mawb text NOT NULL,
  hawb text NOT NULL,
  airline_code text NOT NULL,
  ori_dest text NOT NULL,
  jumlah_pieces int2 NOT NULL,
  agent_code text,
  consignee_code text,
  note_handling text,
  shipper_pic_name text NOT NULL,
  shipper_pic_number text NOT NULL,
  foto_samping_url text,
  CONSTRAINT inspeksi_barang_pkey PRIMARY KEY (id)
);

-- 4. Tabel aktivitas user (audit log)
CREATE TABLE IF NOT EXISTS public.user_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL, -- 'login', 'logout', 'create', 'update', 'delete', 'view'
  target_table text,    -- 'inspeksi_barang', 'profiles', dll
  target_id text,       -- ID dari record yang diakses
  description text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_activities_pkey PRIMARY KEY (id)
);

-- =============================================
-- INSERT DATA AWAL
-- =============================================

-- Insert roles
INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Super Administrator dengan akses penuh'),
  ('admin', 'Administrator dengan akses manajemen data'),
  ('operator', 'Operator yang dapat menginput data inspeksi'),
  ('viewer', 'Hanya dapat melihat data')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspeksi_barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Policies untuk profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Super admin can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admin can manage profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')
    )
  );

-- Policies untuk inspeksi_barang
CREATE POLICY "Authenticated users can view inspeksi" ON public.inspeksi_barang
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Operator and above can insert" ON public.inspeksi_barang
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'operator')
    )
  );

CREATE POLICY "Admin and above can update" ON public.inspeksi_barang
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')
    )
  );

-- Policies untuk user_activities
CREATE POLICY "Users can view own activities" ON public.user_activities
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admin can view all activities" ON public.user_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Authenticated can insert activities" ON public.user_activities
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies untuk roles
CREATE POLICY "Authenticated can view roles" ON public.roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================
-- FUNCTION & TRIGGER
-- =============================================

-- Function untuk auto-create profile saat user baru register
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger untuk new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function untuk updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_inspeksi_updated_at
  BEFORE UPDATE ON public.inspeksi_barang
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- CATATAN SETUP SUPER ADMIN
-- Setelah register user pertama, jalankan:
-- UPDATE public.profiles 
-- SET role_id = (SELECT id FROM public.roles WHERE name = 'super_admin')
-- WHERE email = 'email_super_admin@domain.com';
-- =============================================
