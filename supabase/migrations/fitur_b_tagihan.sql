-- =============================================================
-- Fitur B: Tagihan dan Invoice
-- PRD 6.8, 7.3, 8.2, 9.2, Bab 10
-- =============================================================

-- -------------------------------------------------------------
-- 1. tambah_item_tagihan(p_wo, p_item, p_jumlah)
-- Dipanggil oleh: Kepala Mekanik tim WO, Owner
-- Mengunci baris item dan WO dengan FOR UPDATE
-- -------------------------------------------------------------
create or replace function public.tambah_item_tagihan(
  p_wo uuid,
  p_item uuid,
  p_jumlah int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_item record;
  v_stok_baru int;
  v_harga_modal bigint;
  v_billing_item_id uuid;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null or v_peran not in ('kepala_mekanik', 'owner') then
    raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh menambah item tagihan';
  end if;

  -- 2. Validasi parameter
  if p_wo is null then
    raise exception 'Work Order wajib ditentukan';
  end if;
  if p_item is null then
    raise exception 'Item wajib dipilih';
  end if;
  if p_jumlah is null or p_jumlah < 1 then
    raise exception 'Jumlah item minimal 1';
  end if;

  -- 3. Kunci dan periksa baris Work Order
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Pemeriksaan hubungan tim untuk Kepala Mekanik
  if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani Work Order ini yang boleh menambah item tagihan';
  end if;

  -- Status harus dikerjakan
  if v_wo.status <> 'dikerjakan' then
    raise exception 'Item tagihan hanya dapat ditambahkan saat status Work Order dikerjakan';
  end if;

  -- Pastikan invoice belum terbit
  if exists (select 1 from public.invoices where work_order_id = p_wo) then
    raise exception 'Invoice sudah terbit, tagihan tidak dapat diubah';
  end if;

  -- 4. Kunci dan periksa baris inventory_items
  select * into v_item
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item inventory tidak ditemukan';
  end if;

  if not v_item.aktif then
    raise exception 'Item inventory tidak aktif';
  end if;

  -- 5. Pengurangan stok jika jenis part
  if v_item.jenis = 'part' then
    if v_item.stok < p_jumlah then
      raise exception 'Stok % hanya %', v_item.nama, v_item.stok;
    end if;

    update public.inventory_items
    set stok = stok - p_jumlah,
        updated_at = now()
    where id = p_item
    returning stok into v_stok_baru;

    -- Catat pergerakan stok keluar
    insert into public.stock_movements (
      item_id,
      jenis,
      jumlah,
      stok_sesudah,
      keterangan,
      work_order_id,
      dicatat_oleh
    ) values (
      p_item,
      'keluar',
      -p_jumlah,
      v_stok_baru,
      'Pemakaian pada Work Order ' || v_wo.nomor,
      p_wo,
      auth.uid()
    );
  end if;

  -- 6. Simpan baris ke billing_items
  v_billing_item_id := gen_random_uuid();

  insert into public.billing_items (
    id,
    work_order_id,
    item_id,
    nama_item,
    jenis,
    jumlah,
    harga_master,
    harga_dipakai,
    alasan_penyesuaian,
    ditambah_oleh
  ) values (
    v_billing_item_id,
    p_wo,
    p_item,
    v_item.nama,
    v_item.jenis,
    p_jumlah,
    v_item.harga_jual,
    v_item.harga_jual,
    null,
    auth.uid()
  );

  -- 7. Simpan harga modal ke billing_item_costs (rahasia)
  if v_item.jenis = 'part' then
    select coalesce(harga_modal, 0) into v_harga_modal
    from public.inventory_costs
    where item_id = p_item;

    if not found then
      v_harga_modal := 0;
    end if;
  else
    v_harga_modal := 0; -- Jasa modal 0
  end if;

  insert into public.billing_item_costs (
    billing_item_id,
    harga_modal
  ) values (
    v_billing_item_id,
    coalesce(v_harga_modal, 0)
  );

  return v_billing_item_id;
end;
$$;

revoke all on function public.tambah_item_tagihan(uuid, uuid, int) from public, anon;
grant execute on function public.tambah_item_tagihan(uuid, uuid, int) to authenticated;


-- -------------------------------------------------------------
-- 2. hapus_item_tagihan(p_billing_item)
-- Dipanggil oleh: Kepala Mekanik tim WO, Owner
-- Mengembalikan stok spare part jika jenis part
-- -------------------------------------------------------------
create or replace function public.hapus_item_tagihan(
  p_billing_item uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_bi record;
  v_wo record;
  v_stok_baru int;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null or v_peran not in ('kepala_mekanik', 'owner') then
    raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh menghapus item tagihan';
  end if;

  -- 2. Kunci dan periksa baris billing_items
  select * into v_bi
  from public.billing_items
  where id = p_billing_item
  for update;

  if not found then
    raise exception 'Baris tagihan tidak ditemukan';
  end if;

  -- 3. Kunci dan periksa baris Work Order
  select * into v_wo
  from public.work_orders
  where id = v_bi.work_order_id
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Pemeriksaan hubungan tim untuk Kepala Mekanik
  if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani Work Order ini yang boleh menghapus item tagihan';
  end if;

  -- Status harus dikerjakan
  if v_wo.status <> 'dikerjakan' then
    raise exception 'Item tagihan hanya dapat dihapus saat status Work Order dikerjakan';
  end if;

  -- Pastikan invoice belum terbit
  if exists (select 1 from public.invoices where work_order_id = v_bi.work_order_id) then
    raise exception 'Invoice sudah terbit, baris tagihan tidak dapat dihapus';
  end if;

  -- 4. Kembalikan stok jika jenis part
  if v_bi.jenis = 'part' then
    update public.inventory_items
    set stok = stok + v_bi.jumlah,
        updated_at = now()
    where id = v_bi.item_id
    returning stok into v_stok_baru;

    -- Catat pergerakan stok kembali
    insert into public.stock_movements (
      item_id,
      jenis,
      jumlah,
      stok_sesudah,
      keterangan,
      work_order_id,
      dicatat_oleh
    ) values (
      v_bi.item_id,
      'kembali',
      v_bi.jumlah,
      v_stok_baru,
      'Pengembalian stok penghapusan item WO ' || v_wo.nomor,
      v_bi.work_order_id,
      auth.uid()
    );
  end if;

  -- 5. Hapus baris billing_items (billing_item_costs terhapus otomatis via on delete cascade)
  delete from public.billing_items
  where id = p_billing_item;
end;
$$;

revoke all on function public.hapus_item_tagihan(uuid) from public, anon;
grant execute on function public.hapus_item_tagihan(uuid) to authenticated;


-- -------------------------------------------------------------
-- 3. sesuaikan_harga_item(p_billing_item, p_harga, p_alasan)
-- Dipanggil oleh: Admin, Owner
-- Mengembalikan true jika di bawah modal (tanpa menampilkan angka modal)
-- -------------------------------------------------------------
create or replace function public.sesuaikan_harga_item(
  p_billing_item uuid,
  p_harga bigint,
  p_alasan text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_bi record;
  v_wo record;
  v_harga_modal bigint;
  v_di_bawah_modal boolean;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null or v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh menyesuaikan harga item tagihan';
  end if;

  -- 2. Validasi parameter
  if p_harga is null or p_harga < 0 then
    raise exception 'Harga baru wajib diisi dan tidak boleh negatif';
  end if;

  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan penyesuaian harga wajib diisi';
  end if;

  -- 3. Kunci dan periksa baris billing_items
  select * into v_bi
  from public.billing_items
  where id = p_billing_item
  for update;

  if not found then
    raise exception 'Baris tagihan tidak ditemukan';
  end if;

  -- 4. Kunci dan periksa baris Work Order
  select * into v_wo
  from public.work_orders
  where id = v_bi.work_order_id
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Pastikan invoice belum terbit
  if exists (select 1 from public.invoices where work_order_id = v_bi.work_order_id) then
    raise exception 'Invoice sudah terbit, harga tidak dapat disesuaikan lagi';
  end if;

  -- 5. Perbarui harga_dipakai dan alasan penyesuaian
  update public.billing_items
  set harga_dipakai = p_harga,
      alasan_penyesuaian = trim(p_alasan),
      disesuaikan_oleh = auth.uid(),
      disesuaikan_at = now()
  where id = p_billing_item;

  -- 6. Periksa apakah di bawah modal
  select coalesce(harga_modal, 0) into v_harga_modal
  from public.billing_item_costs
  where billing_item_id = p_billing_item;

  if not found then
    v_harga_modal := 0;
  end if;

  v_di_bawah_modal := (p_harga < v_harga_modal);

  return v_di_bawah_modal;
end;
$$;

revoke all on function public.sesuaikan_harga_item(uuid, bigint, text) from public, anon;
grant execute on function public.sesuaikan_harga_item(uuid, bigint, text) to authenticated;


-- -------------------------------------------------------------
-- 4. atur_diskon(p_wo, p_diskon, p_alasan)
-- Dipanggil oleh: Admin, Owner
-- Syarat: diskon <= subtotal, invoice belum terbit
-- -------------------------------------------------------------
create or replace function public.atur_diskon(
  p_wo uuid,
  p_diskon bigint,
  p_alasan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_subtotal bigint;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null or v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh mengatur diskon';
  end if;

  -- 2. Validasi input
  if p_wo is null then
    raise exception 'Work Order wajib ditentukan';
  end if;

  if p_diskon is null or p_diskon < 0 then
    raise exception 'Diskon tidak boleh negatif';
  end if;

  if p_diskon > 0 and coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan diskon wajib diisi bila terdapat potongan diskon';
  end if;

  -- 3. Kunci dan periksa baris Work Order
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Pastikan invoice belum terbit
  if exists (select 1 from public.invoices where work_order_id = p_wo) then
    raise exception 'Invoice sudah terbit, diskon tidak dapat diubah lagi';
  end if;

  -- 4. Hitung subtotal dan validasi diskon <= subtotal
  select coalesce(sum(jumlah * harga_dipakai), 0) into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if p_diskon > v_subtotal then
    raise exception 'Diskon (Rp%) tidak boleh melebihi subtotal tagihan (Rp%)',
      to_char(p_diskon, 'FM999,999,999,999'),
      to_char(v_subtotal, 'FM999,999,999,999');
  end if;

  -- 5. Simpan diskon ke work_orders
  update public.work_orders
  set diskon = p_diskon,
      alasan_diskon = case when p_diskon > 0 then trim(p_alasan) else null end,
      updated_at = now()
  where id = p_wo;
end;
$$;

revoke all on function public.atur_diskon(uuid, bigint, text) from public, anon;
grant execute on function public.atur_diskon(uuid, bigint, text) to authenticated;


-- -------------------------------------------------------------
-- 5. terbitkan_invoice(p_wo)
-- Dipanggil oleh: Admin, Owner
-- Syarat: status siap_diambil, belum ada invoice
-- Mengunci counter INV dengan FOR UPDATE (INV-YYYYMM-0001)
-- -------------------------------------------------------------
create or replace function public.terbitkan_invoice(
  p_wo uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_subtotal bigint;
  v_diskon bigint;
  v_total bigint;
  v_periode text;
  v_urut int;
  v_nomor text;
  v_invoice_id uuid;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null or v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh menerbitkan invoice';
  end if;

  -- 2. Kunci dan periksa Work Order
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Status harus siap_diambil
  if v_wo.status <> 'siap_diambil' then
    raise exception 'Invoice hanya dapat diterbitkan saat status Work Order siap_diambil';
  end if;

  -- Pastikan invoice belum pernah diterbitkan
  if exists (select 1 from public.invoices where work_order_id = p_wo) then
    raise exception 'Invoice untuk Work Order ini sudah pernah diterbitkan';
  end if;

  -- 3. Hitung subtotal, diskon, dan total
  select coalesce(sum(jumlah * harga_dipakai), 0) into v_subtotal
  from public.billing_items
  where work_order_id = p_wo;

  if v_subtotal <= 0 then
    raise exception 'Tagihan tidak boleh kosong saat menerbitkan invoice';
  end if;

  v_diskon := coalesce(v_wo.diskon, 0);
  if v_diskon > v_subtotal then
    v_diskon := v_subtotal;
  end if;

  v_total := v_subtotal - v_diskon;

  -- 4. Penomoran invoice dengan penguncian counter (FOR UPDATE)
  v_periode := to_char(now(), 'YYYYMM');

  insert into public.number_counters (jenis, periode, terakhir)
  values ('INV', v_periode, 0)
  on conflict (jenis, periode) do nothing;

  select terakhir into v_urut
  from public.number_counters
  where jenis = 'INV' and periode = v_periode
  for update;

  v_urut := v_urut + 1;

  update public.number_counters
  set terakhir = v_urut
  where jenis = 'INV' and periode = v_periode;

  v_nomor := 'INV-' || v_periode || '-' || lpad(v_urut::text, 4, '0');

  -- 5. Terbitkan invoice baru (status bawaan: belum_bayar, terbayar = 0)
  v_invoice_id := gen_random_uuid();

  insert into public.invoices (
    id,
    work_order_id,
    nomor,
    subtotal,
    diskon,
    total,
    terbayar,
    status_bayar,
    diterbitkan_oleh,
    diterbitkan_at
  ) values (
    v_invoice_id,
    p_wo,
    v_nomor,
    v_subtotal,
    v_diskon,
    v_total,
    0,
    'belum_bayar',
    auth.uid(),
    now()
  );

  return v_invoice_id;
end;
$$;

revoke all on function public.terbitkan_invoice(uuid) from public, anon;
grant execute on function public.terbitkan_invoice(uuid) to authenticated;


-- -------------------------------------------------------------
-- 6. catat_pembayaran(p_invoice, p_metode, p_jumlah)
-- Dipanggil oleh: Admin, Owner
-- Mengunci baris invoice dengan FOR UPDATE
-- -------------------------------------------------------------
create or replace function public.catat_pembayaran(
  p_invoice uuid,
  p_metode text,
  p_jumlah bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_inv record;
  v_sisa bigint;
  v_terbayar_baru bigint;
  v_status_bayar_baru text;
begin
  -- 1. Periksa peran pemanggil
  v_peran := private.peran_saya();
  if v_peran is null or v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh mencatat pembayaran';
  end if;

  -- 2. Validasi parameter input
  if p_invoice is null then
    raise exception 'Invoice wajib ditentukan';
  end if;

  if p_metode is null or p_metode not in ('tunai', 'transfer', 'qris') then
    raise exception 'Metode pembayaran tidak valid: %, pilih tunai, transfer, atau qris', p_metode;
  end if;

  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah pembayaran harus lebih dari 0';
  end if;

  -- 3. Kunci dan periksa baris invoice
  select * into v_inv
  from public.invoices
  where id = p_invoice
  for update;

  if not found then
    raise exception 'Invoice tidak ditemukan';
  end if;

  if v_inv.status_bayar = 'lunas' then
    raise exception 'Invoice ini sudah lunas';
  end if;

  -- 4. Validasi jumlah tidak melebihi sisa tagihan
  v_sisa := v_inv.total - v_inv.terbayar;

  if p_jumlah > v_sisa then
    raise exception 'Jumlah pembayaran (Rp%) melebihi sisa tagihan (Rp%)',
      to_char(p_jumlah, 'FM999,999,999,999'),
      to_char(v_sisa, 'FM999,999,999,999');
  end if;

  -- 5. Catat pembayaran ke tabel payments
  insert into public.payments (
    id,
    invoice_id,
    metode,
    jumlah,
    dicatat_oleh
  ) values (
    gen_random_uuid(),
    p_invoice,
    p_metode,
    p_jumlah,
    auth.uid()
  );

  -- 6. Perbarui terbayar dan status_bayar pada invoices
  v_terbayar_baru := v_inv.terbayar + p_jumlah;
  v_status_bayar_baru := case when v_terbayar_baru >= v_inv.total then 'lunas' else 'sebagian' end;

  update public.invoices
  set terbayar = v_terbayar_baru,
      status_bayar = v_status_bayar_baru
  where id = p_invoice;
end;
$$;

revoke all on function public.catat_pembayaran(uuid, text, bigint) from public, anon;
grant execute on function public.catat_pembayaran(uuid, text, bigint) to authenticated;
