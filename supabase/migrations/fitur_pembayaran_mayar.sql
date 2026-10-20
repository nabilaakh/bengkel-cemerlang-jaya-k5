-- =============================================================
-- Fitur: Pembayaran Online Mayar
-- 1. Penambahan kolom pada tabel invoices
-- 2. Dukungan metode 'mayar' pada tabel payments
-- 3. Tabel log webhook mayar_webhook_log (RLS: hanya Owner)
-- 4. Fungsi simpan_link_mayar (Admin & Owner)
-- 5. Fungsi tandai_lunas_mayar (Hanya Secret Key / service_role)
-- =============================================================

-- 1. Tambah kolom integrasi Mayar pada tabel public.invoices
alter table public.invoices
  add column if not exists mayar_invoice_id text unique,
  add column if not exists mayar_link text,
  add column if not exists mayar_jumlah bigint check (mayar_jumlah is null or mayar_jumlah > 0),
  add column if not exists dibayar_online_at timestamptz;

create index if not exists idx_invoices_mayar_invoice_id on public.invoices (mayar_invoice_id);

-- 2. Perbarui check constraint metode pada public.payments agar mendukung 'mayar'
alter table public.payments drop constraint if exists payments_metode_check;
alter table public.payments add constraint payments_metode_check
  check (metode in ('tunai', 'transfer', 'qris', 'mayar'));

-- 3. Tabel mayar_webhook_log untuk pencatatan payload webhook
create table if not exists public.mayar_webhook_log (
  id bigint generated always as identity primary key,
  event text,
  mayar_invoice_id text,
  payload jsonb not null,
  status_proses text not null default 'sukses',
  pesan_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mayar_webhook_log_created_at on public.mayar_webhook_log (created_at desc);
create index if not exists idx_mayar_webhook_log_mayar_id on public.mayar_webhook_log (mayar_invoice_id);

-- Nyalakan RLS pada mayar_webhook_log
alter table public.mayar_webhook_log enable row level security;

-- Cabut akses publik, hanya berikan select ke authenticated (dibatasi policy)
revoke all on table public.mayar_webhook_log from public, anon, authenticated;
grant select on table public.mayar_webhook_log to authenticated;

-- Policy RLS: Hanya Owner yang boleh membaca log webhook
drop policy if exists "mayar_webhook_log_owner_baca" on public.mayar_webhook_log;
create policy "mayar_webhook_log_owner_baca" on public.mayar_webhook_log
  for select to authenticated
  using ((select private.peran_saya()) = 'owner');

-- 4. Fungsi simpan_link_mayar (Admin dan Owner)
create or replace function public.simpan_link_mayar(
  p_invoice uuid,
  p_mayar_invoice_id text,
  p_mayar_link text,
  p_mayar_jumlah bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_inv record;
begin
  -- 1. Periksa peran pengguna
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh menyimpan link pembayaran Mayar';
  end if;

  -- 2. Validasi input
  if p_invoice is null then
    raise exception 'ID Invoice wajib diisi';
  end if;

  if coalesce(trim(p_mayar_invoice_id), '') = '' then
    raise exception 'Mayar Invoice ID wajib diisi';
  end if;

  if coalesce(trim(p_mayar_link), '') = '' then
    raise exception 'Link pembayaran Mayar wajib diisi';
  end if;

  if p_mayar_jumlah is null or p_mayar_jumlah <= 0 then
    raise exception 'Jumlah tagihan Mayar harus lebih besar dari 0';
  end if;

  -- 3. Kunci baris invoice dengan for update
  select id, total, terbayar, status_bayar
  into v_inv
  from public.invoices
  where id = p_invoice
  for update;

  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  if v_inv.status_bayar = 'lunas' then
    raise exception 'Invoice sudah lunas, tidak dapat membuat link pembayaran baru';
  end if;

  if p_mayar_jumlah > (v_inv.total - v_inv.terbayar) then
    raise exception 'Jumlah tagihan Mayar (% rupiah) melebihi sisa tagihan invoice (% rupiah)',
      p_mayar_jumlah, (v_inv.total - v_inv.terbayar);
  end if;

  -- 4. Simpan tautan dan rincian Mayar pada invoice
  update public.invoices
  set mayar_invoice_id = p_mayar_invoice_id,
      mayar_link = p_mayar_link,
      mayar_jumlah = p_mayar_jumlah
  where id = p_invoice;
end;
$$;

revoke all on function public.simpan_link_mayar(uuid, text, text, bigint) from public, anon;
grant execute on function public.simpan_link_mayar(uuid, text, text, bigint) to authenticated;

-- 5. Fungsi tandai_lunas_mayar (Hanya Secret Key / service_role)
create or replace function public.tandai_lunas_mayar(
  p_mayar_invoice_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_jumlah_bayar bigint;
  v_terbayar_baru bigint;
  v_status_baru text;
begin
  -- 1. Proteksi ketat: hanya bisa dijalankan lewat Secret Key (service_role atau postgres)
  if auth.role() <> 'service_role' and current_user not in ('service_role', 'postgres') then
    raise exception 'Fungsi tandai_lunas_mayar hanya dapat dijalankan dengan secret key (service role)';
  end if;

  -- 2. Validasi parameter
  if coalesce(trim(p_mayar_invoice_id), '') = '' then
    raise exception 'Mayar Invoice ID wajib diisi';
  end if;

  -- 3. Kunci baris invoice dengan for update
  select id, total, terbayar, status_bayar, mayar_jumlah
  into v_inv
  from public.invoices
  where mayar_invoice_id = p_mayar_invoice_id
  for update;

  if not found then
    raise exception 'Invoice dengan Mayar Invoice ID % tidak ditemukan', p_mayar_invoice_id;
  end if;

  -- 4. Idempotensi: Bila sudah lunas, jangan catat pembayaran ganda
  if v_inv.status_bayar = 'lunas' then
    return jsonb_build_object(
      'status', 'sudah_lunas',
      'pesan', 'Invoice sudah berstatus lunas sebelumnya',
      'invoice_id', v_inv.id,
      'terbayar', v_inv.terbayar
    );
  end if;

  -- 5. Tentukan jumlah pembayaran dari mayar_jumlah (atau sisa tagihan bila mayar_jumlah kosong)
  v_jumlah_bayar := coalesce(v_inv.mayar_jumlah, v_inv.total - v_inv.terbayar);
  if v_jumlah_bayar <= 0 then
    raise exception 'Sisa tagihan invoice tidak valid';
  end if;

  -- 6. Catat baris pembayaran baru dengan metode 'mayar'
  insert into public.payments (
    invoice_id,
    metode,
    jumlah,
    dicatat_oleh
  ) values (
    v_inv.id,
    'mayar',
    v_jumlah_bayar,
    null -- dicatat otomatis oleh sistem webhook
  );

  -- 7. Perbarui status pembayaran invoice
  v_terbayar_baru := v_inv.terbayar + v_jumlah_bayar;
  v_status_baru := case when v_terbayar_baru >= v_inv.total then 'lunas' else 'sebagian' end;

  update public.invoices
  set terbayar = v_terbayar_baru,
      status_bayar = v_status_baru,
      dibayar_online_at = now()
  where id = v_inv.id;

  return jsonb_build_object(
    'status', 'sukses',
    'invoice_id', v_inv.id,
    'jumlah_dibayar', v_jumlah_bayar,
    'terbayar', v_terbayar_baru,
    'status_bayar', v_status_baru
  );
end;
$$;

-- Izin eksekusi tandai_lunas_mayar hanya untuk service_role
revoke all on function public.tandai_lunas_mayar(text) from public, anon, authenticated;
grant execute on function public.tandai_lunas_mayar(text) to service_role;
