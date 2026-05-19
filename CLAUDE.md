# Panduan Claude — Sales Tracker Blue

## Konteks Bisnis
Aplikasi PWA input penjualan rokok untuk toko grosir di Kabupaten Madiun, Jawa Timur.
- 8+ sales aktif dengan pembagian wilayah masing-masing
- Manager butuh dashboard harian untuk briefing pagi
- Sinyal internet sering lemah (area pedesaan) — fitur offline-first sudah ada
- User (sales) cukup awam teknologi — UI harus simpel dan tidak membingungkan

---

## Stack Teknologi
- Frontend: React + TypeScript + TanStack Start (SSR)
- Database & Auth: Supabase (PostgreSQL + Auth + Edge Functions)
- Hosting: Cloudflare Workers
- Chart: Recharts
- UI: Tailwind CSS + shadcn/ui
- Build: Vite + @lovable.dev/vite-tanstack-config

---

## Struktur File Penting
src/routes/_app/
  admin/
    index.tsx        -> Dashboard beranda admin (metrik harian + bulanan + ringkasan bulan)
    analytics.tsx    -> Halaman analitik (10 chart + Highlight narasi otomatis)
    products.tsx     -> Manajemen produk rokok (CRUD + harga)
    sales.tsx        -> Manajemen akun sales
    transactions.tsx -> Riwayat semua transaksi
    settings.tsx     -> Pengaturan aplikasi
  sales/
    index.tsx        -> Beranda sales
    input.tsx        -> Form input penjualan (GPS + offline queue)
    history.tsx      -> Riwayat penjualan milik sales

src/lib/
  offline-queue.ts   -> Antrian transaksi saat offline
  sync-pending.ts    -> Sinkronisasi transaksi pending ke Supabase
  register-sw.ts     -> Service Worker registration + auto-reload saat update deploy

public/
  sw.js              -> Service Worker (cache name: binowo-v4)

supabase/
  migrations/        -> Semua migration SQL (sudah applied semua)
  functions/
    cleanup-old-data/   -> Hapus data lama otomatis
    create-user/        -> Buat akun user baru
    sync-transaction/   -> Sinkronisasi transaksi offline

---

## Database — Tabel Utama
- sales_transactions : header transaksi (id, transaction_date, total_amount, sales_code, notes, store_id)
- transaction_items  : detail item (product_name, quantity, unit_price, subtotal, transaction_id)
- cigarette_products : master produk (name, price, is_active)
- stores             : data toko pelanggan
- profiles           : profil user
- user_roles         : role admin atau sales

## Proteksi Harga Historis (PENTING)
Sudah ada trigger di database:
- trg_lock_transaction_items    -> BLOKIR semua UPDATE pada transaction_items setelah tersimpan
- trg_lock_sales_transactions   -> BLOKIR update total_amount/store_id/tanggal (photo_url boleh)
Mengubah harga produk di admin TIDAK akan mempengaruhi riwayat transaksi lama.

## Migration yang Sudah Ada
- 20260511143923 -> skema awal (profiles, stores, products, transactions)
- 20260511143949 -> tambahan skema
- 20260511152859 -> tambahan skema
- 20260511153001 -> tambahan skema
- 20260517155121 -> trigger proteksi harga historis

## Perintah Migration
npx supabase db push
Kalau error "relation already exists":
  npx supabase migration repair --status applied <timestamp>
  npx supabase db push

---

## Deploy

Deploy normal (setelah edit kode src/):
  npm run build && npx wrangler deploy

Rebuild dari nol (kalau dist rusak/bermasalah):
  rm -rf dist .wrangler && npm run build && npx wrangler deploy

Perubahan database saja (tidak perlu deploy Cloudflare):
  npx supabase db push

PANTANGAN — JANGAN DILAKUKAN:
- JANGAN hapus dist tanpa langsung rebuild — build akan gagal (plugin butuh 2 tahap)
- JANGAN ubah main di wrangler.jsonc dari src/server.ts ke apapun
- JANGAN tambah field assets di wrangler.jsonc — sudah dihandle otomatis plugin

---

## Service Worker (public/sw.js)
- Cache name: binowo-v4
- HTML/navigasi: network-first (selalu ambil dari server)
- Assets JS/CSS hashed: cache-first (aman karena hash berubah otomatis saat deploy)
- Saat SW baru aktif: kirim pesan SW_UPDATED ke semua tab -> halaman auto-reload
- Untuk paksa update cache di semua HP sales: bump versi (v4 -> v5) lalu deploy

---

## Fitur GPS (sales/input.tsx)
Fallback 3 tahap saat sinyal lemah:
1. GPS presisi tinggi, timeout 30 detik
2. GPS presisi rendah, timeout 20 detik (boleh pakai cache koordinat 5 menit)
3. Lanjut tanpa koordinat — transaksi tetap tersimpan, tidak diblokir

---

## Fitur Login
- Retry otomatis hingga 3x saat sinyal lemah (jeda 2s, 4s, 6s)
- Berhenti retry jika error bukan masalah jaringan (misal: password salah)

---

## Halaman Analitik (admin/analytics.tsx)
Filter: rentang tanggal + kode sales. Semua chart mengikuti filter.

Kategori Penjualan:
1. Penjualan per Tanggal (Line Chart)
2. Top Produk Nilai Penjualan (List dengan warna)

Kategori Distribusi:
3. Toko Paling Banyak Belanja (Bar horizontal, top 10)
4. Rata-rata Nilai per Kunjungan Toko (List)
5. Toko yang Nilai Belanjaannya Turun (vs periode sebelumnya sama panjang)
6. Distribusi Stok Rokok per Toko (Tabel dari field notes transaksi)

Kategori Manajemen Sales:
7. Papan Peringkat Sales (total omzet + kunjungan)
8. Penjualan per Sales per Produk (Stacked Bar)
9. Frekuensi Kunjungan Toko (Loyal >=3x/minggu, Reguler 1-2x, Pasif <4x/bulan)
10. Produk Terlaris per Sales (top 3 produk per sales)

## Highlight (Narasi Otomatis) — paling atas halaman analitik
- Narasi dinamis — tone dan urutan berubah berdasarkan kondisi data
- Banyak toko turun -> pembuka berisi peringatan
- Produk dominasi >40% -> peringatkan ketergantungan + saran cross-sell
- Persaingan sales tipis -> kalimat berbeda dari yang dominasi jauh
- Produk "Tidak ada" dan string kosong difilter dari analisa
- 5 blok: pembuka situasi -> produk -> kinerja sales -> distribusi toko -> fokus briefing
- Selalu mengikuti filter aktif

---

## Dashboard Beranda (admin/index.tsx)
- Metrik Harian: transaksi + nilai (pilih tanggal lewat ikon kalender)
- Metrik Bulanan: total transaksi + nilai + produk aktif (navigasi bulan kiri/kanan)
- Ringkasan Bulan: sales terbaik, produk terlaris, toko terbesar, rata-rata harian,
  peringkat semua sales — otomatis berubah saat bulan diganti

---

## Role Pengguna
- admin -> Dashboard, analitik, manajemen produk/sales/transaksi, settings
- sales -> Input penjualan, riwayat penjualan sendiri saja

---

## Tips Workflow dengan Claude
1. Sebelum edit file besar -> cat -n <file> dulu dan tunjukkan hasilnya ke Claude
2. Untuk patch teks -> gunakan Python dengan line numbers, BUKAN heredoc bash
   (heredoc sering gagal untuk teks panjang dengan backtick/karakter khusus)
3. Setelah edit src/             -> wajib npm run build && npx wrangler deploy
4. Setelah edit supabase/migrations/ -> cukup npx supabase db push
5. Setelah edit public/sw.js     -> wajib deploy ulang agar SW terdistribusi
6. Kalau build tiba-tiba gagal   -> rm -rf dist .wrangler && npm run build && npx wrangler deploy
