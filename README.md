# InspeksiPro — Sistem Manajemen Inspeksi Barang

Aplikasi web React + Vite + Tailwind CSS yang terhubung ke database Supabase yang sama dengan aplikasi Electron.

---

## 🚀 Setup Cepat

### 1. Install Dependencies

```bash
npm install
```

### 2. Konfigurasi Supabase

Salin file `.env.example` ke `.env.local`:

```bash
cp .env.example .env.local
```

Isi dengan kredensial Supabase Anda:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> Temukan nilai ini di: Supabase Dashboard → Project Settings → API

### 3. Setup Database

Jalankan file `supabase_schema.sql` di **Supabase SQL Editor**:

1. Buka Supabase Dashboard → SQL Editor
2. Klik "New Query"
3. Paste seluruh isi `supabase_schema.sql`
4. Klik "Run"

### 4. Setup Super Admin

Setelah schema dijalankan dan akun pertama didaftarkan, set role super_admin:

```sql
UPDATE public.profiles 
SET role_id = (SELECT id FROM public.roles WHERE name = 'super_admin')
WHERE email = 'email_anda@domain.com';
```

### 5. Jalankan Aplikasi

```bash
npm run dev
```

Buka http://localhost:5173

---

## 📦 Build untuk Production

```bash
npm run build
```

Output ada di folder `dist/`. Deploy ke hosting static seperti Vercel, Netlify, atau Nginx.

---

## 🏗️ Struktur Aplikasi

```
src/
├── components/
│   └── Layout.tsx          # Sidebar + topbar navigasi
├── hooks/
│   └── useAuth.tsx         # Context autentikasi
├── lib/
│   └── supabase.ts         # Client Supabase + types + logActivity
├── pages/
│   ├── LoginPage.tsx       # Halaman login
│   ├── DashboardPage.tsx   # Dashboard dengan chart & statistik
│   ├── DataPage.tsx        # Tabel data inspeksi + filter + export
│   ├── DetailPage.tsx      # Detail + edit data inspeksi
│   ├── AktivitasPage.tsx   # Log aktivitas user
│   └── UsersPage.tsx       # Manajemen user (Super Admin)
└── index.css               # Global styles + Tailwind
```

---

## 👥 Sistem Role

| Role        | Dashboard | Data | Edit Data | Log Aktivitas | Manajemen User |
|-------------|-----------|------|-----------|---------------|----------------|
| Super Admin | ✅        | ✅   | ✅        | ✅            | ✅             |
| Admin       | ✅        | ✅   | ✅        | ✅            | ❌             |
| Operator    | ✅        | ✅   | ❌        | ❌            | ❌             |
| Viewer      | ✅        | ✅   | ❌        | ❌            | ❌             |

---

## 📊 Fitur

- **Login** — Autentikasi dengan Supabase Auth, log aktivitas otomatis
- **Dashboard** — Statistik ringkasan, grafik tren 7 hari, distribusi tipe
- **Data Inspeksi** — Tabel dengan filter, pagination, export CSV
- **Detail Data** — Lihat & edit detail inspeksi (khusus Admin+)
- **Log Aktivitas** — Pantau login/logout/edit semua user (khusus Admin+)
- **Manajemen User** — Buat/edit/nonaktifkan user (khusus Super Admin)

---

## 🔧 Catatan Penting

### Membuat User Baru (Super Admin)
Halaman manajemen user menggunakan `supabase.auth.admin.createUser()` yang memerlukan **Service Role Key** (bukan Anon Key). 

Untuk production, buat Supabase Edge Function atau backend API untuk handle pembuatan user, lalu panggil dari frontend.

Alternatif sementara: buat user manual via Supabase Dashboard → Authentication → Users.

### Row Level Security
Schema sudah include RLS policies. Pastikan RLS diaktifkan di semua tabel.

### Kolom Baru di inspeksi_barang
Schema menambahkan kolom `created_by`, `updated_at`, `updated_by`, dan `catatan` ke tabel `inspeksi_barang`. Jika tabel sudah ada, jalankan:

```sql
ALTER TABLE public.inspeksi_barang 
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS catatan text;
```
