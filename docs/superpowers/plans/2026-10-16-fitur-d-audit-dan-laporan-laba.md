# Rencana Implementasi Halaman Audit Log dan Laporan Laba (Fitur D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan halaman `/audit-log` dan `/laporan-laba` untuk Owner sesuai PRD 6.12 dan 6.13, menggantikan placeholder `KerangkaFitur`.

**Architecture:**
- Kedua halaman adalah Server Component di bawah layout `(app)`.
- Menggunakan `ambilProfilSaya()` untuk proteksi peran Owner (redirect ke `/dashboard` bila bukan Owner).
- `/audit-log` mengambil data tabel `audit_logs` 20 baris per halaman, dilengkapi penyaring tabel, pelaku, dan aksi, serta client dialog `DialogDetailAudit` untuk perbandingan sebelum dan sesudah.
- `/laporan-laba` memanggil database function `laporan_laba(p_dari, p_sampai)` via `supabase.rpc()`, menampilkan 4 kartu KPI ringkasan dan tabel detail per WO dengan pewarnaan laba minus.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui (Table, Card, Badge, Dialog, Button, Input, Select), `@supabase/ssr`.

**Spec:** [`docs/PRD.md`](file:///c:/Users/LENOVO/Bootcamp-FutureMakers/APP4/bengkel-cemerlang-jaya-k5/docs/PRD.md) Bab 6.12, 6.13, 8.2, 9.3, 10.2, 13.

## Global Constraints
- Bahasa antarmuka dan pesan error sepenuhnya Bahasa Indonesia.
- TypeScript strict, tanpa `any`, tipe diambil dari `src/types/database.ts`.
- Hemat egress: Audit log 20 baris per halaman (`PER_HALAMAN = 20`), ambil kolom yang ditampilkan.
- Laporan laba dihitung di database lewat `laporan_laba(p_dari, p_sampai)`.
- Ikuti token warna `src/app/globals.css`.

---

### Task 1: Komponen Dialog Perbandingan Audit Log (`DialogDetailAudit.tsx`)
**Files:**
- Create: `src/app/(app)/audit-log/DialogDetailAudit.tsx`

- [ ] **Step 1: Implementasi komponen client dialog perbandingan**
  - Menerima props: `log` (waktu, aksi, tabel, data_id, sebelum, sesudah, alasan, nama_pelaku, peran).
  - Menguraikan key `sebelum` dan `sesudah` JSONB untuk menampilkan perbandingan field per baris.
  - Menandai baris field yang nilainya berubah, ditambah, atau dihapus.
  - Menggunakan dialog shadcn/ui.

### Task 2: Halaman Audit Log (`/audit-log/page.tsx`)
**Files:**
- Modify: `src/app/(app)/audit-log/page.tsx`

- [ ] **Step 1: Implementasi Server Component `HalamanAuditLog`**
  - Cek peran: pastikan `profil.peran === 'owner'`, jika tidak redirect ke `/dashboard`.
  - Baca search params: `hal` (default 1), `tabel`, `pelaku`, `aksi`.
  - Query daftar profil untuk dropdown pelaku.
  - Query data `audit_logs` dengan pagination `range((hal-1)*20, hal*20 - 1)` dan filter `tabel`, `pelaku_id`, `aksi`.
  - Render form filter, tabel audit log, modal perbandingan, dan navigasi `Paginasi`.

### Task 3: Halaman Laporan Laba (`/laporan-laba/page.tsx`)
**Files:**
- Modify: `src/app/(app)/laporan-laba/page.tsx`

- [ ] **Step 1: Implementasi Server Component `HalamanLaporanLaba`**
  - Cek peran: pastikan `profil.peran === 'owner'`, jika tidak redirect ke `/dashboard`.
  - Baca search params: `dari`, `sampai`, `periode` (default 'bulan_ini').
  - Hitung tanggal default: awal bulan ini s.d. hari ini (Asia/Jakarta).
  - Panggil `supabase.rpc('laporan_laba', { p_dari, p_sampai })`.
  - Hitung agregasi KPI (Total Pendapatan, Modal, Laba Kotor, Margin %).
  - Render preset periode & filter tanggal, 4 kartu KPI, tabel rincian per WO dengan link ke `/work-orders/[id]`, serta penanda merah jika laba < 0.

### Task 4: Verifikasi & Type Checking
- [ ] **Step 1: Jalankan `npx tsc --noEmit` untuk validasi tipe**
- [ ] **Step 2: Uji kedua halaman via browser subagent / HTTP check**
