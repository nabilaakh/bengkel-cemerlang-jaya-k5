# Implementasi Fitur C: Inventory, Pengguna, dan Setelan Bengkel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun antarmuka lengkap untuk Modul Inventory (`/inventory`), Manajemen Pengguna (`/pengguna`), dan Setelan Bengkel (`/setelan`) sesuai PRD 6.4, 6.10, dan 6.11 dengan dukungan hemat egress, kontrol peran, dan integrasi bucket publik Supabase Storage.

**Architecture:** Menggunakan Next.js 15 App Router Server Component untuk kueri data berhalaman 20 baris dengan seleksi kolom minimal. Komponen interaktif (Dialog Form, Stok Masuk, Sesuaikan Stok, Upload Gambar) menggunakan Client Component dengan `react-hook-form`, `zod`, dan Supabase Browser Client.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui (Table, Tabs, Dialog, Badge, Card, Button, Input, Select, Textarea), Supabase JS Client, `browser-image-compression`, `lucide-react`, `sonner`.

**Spec:** [docs/PRD.md](file:///d:/Bootcamp/Bengkel/bengkel-cemerlang-jaya-k5/docs/PRD.md) (Bab 6.4, 6.10, 6.11, 8.2, 9.2, 10.2, 11)

## Global Constraints
- Bahasa antarmuka dan pesan kesalahan wajib Bahasa Indonesia.
- TypeScript strict, tanpa `any`, menggunakan tipe dari `src/types/database.ts`.
- Hemat egress: Hanya mengambil kolom yang ditampilkan, daftar 20 baris per halaman (`PER_HALAMAN = 20`).
- Keamanan modal: Kolom `inventory_costs(harga_modal)` HANYA boleh diambil di server bila `profil.peran === "owner"`. Admin dan Kepala Mekanik tidak menerima data harga modal sama sekali.
- Mutasi stok: Stok tidak boleh diubah secara langsung; stok masuk wajib memanggil `catat_stok_masuk`, penyesuaian stok wajib memanggil `sesuaikan_stok`.

---

### Task 1: Utility Kompresi Gambar untuk Bucket Publik
**Files:**
- Create: `src/lib/gambar.ts`

- [ ] **Step 1: Buat helper `kompresiFoto` di `src/lib/gambar.ts`**
  Menggunakan `browser-image-compression` dengan setelan: maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true, fileType: "image/webp", initialQuality: 0.8.

---

### Task 2: Modul Inventory (`/inventory`)
**Files:**
- Modify: `src/app/(app)/inventory/page.tsx`
- Create: `src/app/(app)/inventory/FormItem.tsx`
- Create: `src/app/(app)/inventory/DialogStokMasuk.tsx`
- Create: `src/app/(app)/inventory/DialogSesuaikanStok.tsx`

- [ ] **Step 1: Buat `FormItem.tsx`**
  Dialog form tambah/ubah item (Spare Part atau Jasa).
  - Validasi zod: `nama` (min 1), `harga_jual` (>= 0), `stok_minimum` (>= 0), `kode` (opsional), `harga_modal` (opsional/hanya tampil untuk Owner).
  - Jika Owner mengisi modal pada spare part baru/lama, simpan/upsert ke tabel `inventory_costs`.
  - Admin yang menambah spare part tidak melihat input modal.
- [ ] **Step 2: Buat `DialogStokMasuk.tsx`**
  Dialog untuk tombol "Stok Masuk" (Admin & Owner):
  - Form: `jumlah` (min 1), `keterangan` (opsional).
  - Memanggil `supabase.rpc('catat_stok_masuk', { p_item, p_jumlah, p_keterangan })`.
  - Notifikasi sukses/error lewat Sonner toast dan `router.refresh()`.
- [ ] **Step 3: Buat `DialogSesuaikanStok.tsx`**
  Dialog untuk tombol "Sesuaikan Stok" (Owner saja):
  - Form: `stok_fisik` (min 0), `alasan` (wajib diisi).
  - Memanggil `supabase.rpc('sesuaikan_stok', { p_item, p_stok_fisik, p_alasan })`.
  - Notifikasi sukses/error lewat Sonner toast dan `router.refresh()`.
- [ ] **Step 4: Implementasikan `src/app/(app)/inventory/page.tsx`**
  Server Component dengan tab:
  - Tab 1: **Spare Part**: Kolom SKU, Nama, Stok, Stok Minimum, Harga Jual, Harga Modal (hanya jika Owner), Status (Aman/Menipis/Habis), Aksi (Stok Masuk, Sesuaikan Stok, Ubah).
  - Tab 2: **Jasa**: Kolom Kode, Nama Jasa, Tarif, Aksi (Ubah).
  - Tab 3: **Riwayat Stok**: Kolom Tanggal, Item, Jenis Mutasi, Jumlah, Stok Sesudah, Keterangan, No WO, Pencatat.
  - Search box, filter status stok, paginasi 20 baris dengan `Paginasi`.

---

### Task 3: Modul Manajemen Pengguna (`/pengguna`)
**Files:**
- Modify: `src/app/(app)/pengguna/page.tsx`
- Create: `src/app/(app)/pengguna/FormPengguna.tsx`

- [ ] **Step 1: Buat `FormPengguna.tsx`**
  Dialog edit pengguna untuk Owner:
  - Field: Nama*, Peran (`owner` | `admin` | `kepala_mekanik`), Status Aktif (`true` | `false`).
  - Mengupdate tabel `profiles`.
  - Mencegah Owner menonaktifkan atau menurunkan peran dirinya jika dia adalah Owner aktif terakhir.
- [ ] **Step 2: Implementasikan `src/app/(app)/pengguna/page.tsx`**
  Server Component:
  - Verifikasi peran `owner` (jika bukan owner, tampilkan peringatan/redirect).
  - Daftar akun dari tabel `profiles` (hanya kolom: `id, nama, email, role, aktif, created_at`).
  - Search box, tabel akun dengan badge peran & badge aktif/nonaktif, tombol ubah per baris, dan `Paginasi` 20 baris.

---

### Task 4: Modul Setelan Bengkel (`/setelan`)
**Files:**
- Modify: `src/app/(app)/setelan/page.tsx`
- Create: `src/app/(app)/setelan/FormBengkel.tsx`
- Create: `src/app/(app)/setelan/KelolaLogo.tsx`
- Create: `src/app/(app)/setelan/KelolaGaleri.tsx`

- [ ] **Step 1: Buat `FormBengkel.tsx`**
  Form edit profil bengkel: Nama Bengkel*, Alamat*, Telepon*, Jam Buka.
  - Update ke `workshop_settings` where `id = 1`.
- [ ] **Step 2: Buat `KelolaLogo.tsx`**
  Komponen upload logo bengkel ke bucket `publik/logo/`:
  - Kompresi foto sebelum upload.
  - Upload file ke storage bucket `publik` di path `logo/<timestamp>-<filename>.webp`.
  - Update `workshop_settings.logo_path`.
  - Preview logo langsung dari URL publik.
- [ ] **Step 3: Buat `KelolaGaleri.tsx`**
  Komponen galeri 3-6 foto halaman depan di `publik/galeri/`:
  - Upload foto ke `publik/galeri/<timestamp>-<filename>.webp`.
  - Preview kisi galeri.
  - Hapus foto dari galeri dan update array `workshop_settings.galeri_paths`.
- [ ] **Step 4: Implementasikan `src/app/(app)/setelan/page.tsx`**
  Server Component:
  - Guard: hanya peran `owner`.
  - Ambil data dari `workshop_settings` (id = 1).
  - Susun kartu Informasi Bengkel, kartu Logo Bengkel, dan kartu Galeri Foto Halaman Depan.

---

### Task 5: Validasi, Type-Check, dan Verifikasi Lengkap
- [ ] **Step 1: Jalankan `npx tsc --noEmit` untuk memastikan tidak ada kesalahan tipe.**
- [ ] **Step 2: Verifikasi tampilan di dev server dan pastikan semua skenario berjalan mulus.**
