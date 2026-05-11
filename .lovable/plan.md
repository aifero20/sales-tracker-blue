# Aplikasi Input Penjualan Rokok (PWA)

Web app responsif (bisa di-install di Android home screen) dengan tema profesional putih–biru.

## Tech Stack
- **Frontend**: TanStack Start (React) + Tailwind, design system putih–biru
- **Backend & Auth**: Lovable Cloud (login email/password, role admin/sales)
- **Database utama**: Lovable Cloud (cepat & aman)
- **Sync ke Google Sheets**: tiap transaksi dimirror ke spreadsheet
- **Foto toko**: di-upload ke Google Drive, link disimpan di DB & Sheets
- **PWA**: manifest + service worker supaya bisa "Install ke Home Screen"

## Database (Lovable Cloud)
- `profiles` — id, email, full_name, sales_code (BP01..), role
- `user_roles` — user_id, role (admin|sales) — pakai pola aman has_role()
- `cigarette_products` — id, name, price_per_pcs (seed: Daun12 6800, Daun16 8800, Refill12 8800, Sigara12 7000, Sultan16 8000, Inggil16 9000, Starlet16 9000, Angsal16 8000, Berry16 9000, Korek 1200)
- `stores` — id, name, address, created_by (auto-fill saat input nama toko sama)
- `sales_transactions` — id, sales_user_id, store_id, transaction_date, transaction_time, sequence_number (urutan harian), latitude, longitude, photo_url (Drive), total_amount, notes (stok jenis rokok di toko)
- `transaction_items` — transaction_id, product_id, quantity, unit_price, subtotal
- RLS: sales hanya lihat datanya sendiri, admin lihat semua

## Halaman & Fitur
**Public**
- `/login` — email + password

**Sales (`/_authenticated/sales/...`)**
- `/sales` — dashboard ringkas (total transaksi hari ini, total nilai)
- `/sales/input` — form input penjualan:
  - Foto toko (kamera HP) → upload Google Drive
  - GPS lat/long otomatis (Geolocation API)
  - Tanggal & jam otomatis
  - Sequence # otomatis (hitung transaksi sales hari itu)
  - Sales code otomatis dari login
  - Nama toko (autocomplete dari `stores`) → alamat auto-fill
  - List 10 rokok dgn stepper (+/-), harga satuan + subtotal real-time
  - Grand total real-time
  - Keterangan stok (textarea wajib)
  - Tombol Simpan → Cloud + sync Sheets + upload foto Drive
- `/sales/history` — riwayat transaksi miliknya + total

**Admin (`/_authenticated/admin/...`)**
- `/admin` — dashboard semua sales
- `/admin/transactions` — semua transaksi (filter sales, tanggal)
- `/admin/analytics` — chart interaktif (Recharts): penjualan per sales, per produk, per tanggal
- `/admin/products` — CRUD rokok
- `/admin/sales` — tambah/edit akun sales (buat user + assign sales_code + role)

## Sync Google Sheets & Drive
Server function tiap simpan transaksi:
1. Upload foto ke Google Drive folder → dapat shareable link
2. Append row ke Sheet "Transaksi" (semua kolom + link foto + link maps)
3. Append rows ke Sheet "Items" (detail per produk)

## Design
- Putih dominan + biru profesional (oklch primary biru), aksen glass/shadow halus
- Mobile-first (sales kerja di HP), tabel admin responsif
- Tipografi bersih (Inter), card rounded, ikon lucide

## Implementasi bertahap (saya akan bangun semua di turn ini)
1. Enable Lovable Cloud + connect Google Sheets + Google Drive
2. Setup design system putih–biru
3. Schema DB + RLS + seed produk
4. Auth + login page + role guard
5. Layout sales & admin (sidebar/bottom nav)
6. Form input penjualan (kamera, GPS, stepper, autocomplete toko)
7. Server function: simpan + sync Sheets + upload Drive
8. History sales
9. Admin: transaksi, analytics chart, CRUD produk, kelola sales
10. PWA manifest

## Catatan penting
- **Google Sheets connector** mengakses **akun Google Anda** (developer). Saat connect saya akan minta Anda pilih akun + sheet. Anda perlu siapkan 1 spreadsheet kosong — saya kasih tahu nama tab yg dibuat.
- **Browser kamera & GPS** butuh HTTPS (preview Lovable sudah HTTPS ✓) dan user harus izinkan.
- Karena scope besar, saya bangun struktur lengkap, lalu Anda test bertahap; perbaikan kecil bisa cepat di iterasi berikutnya.
