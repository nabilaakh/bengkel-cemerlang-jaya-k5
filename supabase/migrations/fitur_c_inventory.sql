-- =============================================================
-- Fitur C: Inventory dan Bucket Publik
-- Sesuai PRD 9.2 (Fungsi Bisnis) dan PRD Bab 11 (Storage)
-- =============================================================

-- -------------------------------------------------------------
-- 1. Fungsi catat_stok_masuk(p_item, p_jumlah, p_keterangan)
-- Dipanggil oleh: Admin, Owner
-- Mengunci baris item dengan FOR UPDATE
-- -------------------------------------------------------------
create or replace function public.catat_stok_masuk(
  p_item uuid,
  p_jumlah int,
  p_keterangan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jenis text;
  v_stok int;
begin
  -- 1. Periksa peran di awal
  if private.peran_saya() not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh mencatat stok masuk';
  end if;

  -- 2. Validasi jumlah
  if p_jumlah is null or p_jumlah < 1 then
    raise exception 'Jumlah stok masuk minimal 1';
  end if;

  -- 3. Kunci baris item dengan FOR UPDATE
  select jenis, stok into v_jenis, v_stok
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item spare part tidak ditemukan';
  end if;

  if v_jenis <> 'part' then
    raise exception 'Hanya item jenis spare part yang memiliki stok';
  end if;

  -- 4. Tambah stok pada item
  update public.inventory_items
  set stok = stok + p_jumlah
  where id = p_item;

  -- 5. Catat pergerakan di stock_movements
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
    'masuk',
    p_jumlah,
    v_stok + p_jumlah,
    p_keterangan,
    null,
    auth.uid()
  );
end;
$$;

revoke all on function public.catat_stok_masuk(uuid, int, text) from public, anon;
grant execute on function public.catat_stok_masuk(uuid, int, text) to authenticated;


-- -------------------------------------------------------------
-- 2. Fungsi sesuaikan_stok(p_item, p_stok_fisik, p_alasan)
-- Dipanggil oleh: Owner
-- Mengunci baris item dengan FOR UPDATE
-- -------------------------------------------------------------
create or replace function public.sesuaikan_stok(
  p_item uuid,
  p_stok_fisik int,
  p_alasan text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jenis text;
  v_stok_lama int;
  v_selisih int;
begin
  -- 1. Periksa peran di awal
  if private.peran_saya() <> 'owner' then
    raise exception 'Hanya Owner yang boleh menyesuaikan stok';
  end if;

  -- 2. Validasi alasan dan nilai stok fisik
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'Alasan penyesuaian stok wajib diisi';
  end if;

  if p_stok_fisik is null or p_stok_fisik < 0 then
    raise exception 'Stok fisik tidak boleh negatif';
  end if;

  -- 3. Kunci baris item dengan FOR UPDATE
  select jenis, stok into v_jenis, v_stok_lama
  from public.inventory_items
  where id = p_item
  for update;

  if not found then
    raise exception 'Item spare part tidak ditemukan';
  end if;

  if v_jenis <> 'part' then
    raise exception 'Hanya item jenis spare part yang memiliki stok';
  end if;

  -- 4. Hitung selisih (bisa bernilai negatif bila penyesuaian turun)
  v_selisih := p_stok_fisik - v_stok_lama;

  -- 5. Perbarui stok item
  update public.inventory_items
  set stok = p_stok_fisik
  where id = p_item;

  -- 6. Catat pergerakan di stock_movements
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
    'penyesuaian',
    v_selisih,
    p_stok_fisik,
    trim(p_alasan),
    null,
    auth.uid()
  );
end;
$$;

revoke all on function public.sesuaikan_stok(uuid, int, text) from public, anon;
grant execute on function public.sesuaikan_stok(uuid, int, text) to authenticated;


-- -------------------------------------------------------------
-- 3. Bucket publik & Policy di storage.objects (PRD Bab 11)
-- -------------------------------------------------------------
-- Buat bucket 'publik' jika belum ada (ukuran maks 1 MB, mime types: webp, jpeg, png)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publik',
  'publik',
  true,
  1048576,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Policy unduh / tampil untuk siapa pun
drop policy if exists "publik_baca" on storage.objects;
create policy "publik_baca" on storage.objects for select
  using (bucket_id = 'publik');

-- Policy unggah untuk Owner
drop policy if exists "publik_unggah_owner" on storage.objects;
create policy "publik_unggah_owner" on storage.objects for insert to authenticated
  with check (bucket_id = 'publik' and (select private.peran_saya()) = 'owner');

-- Policy ubah/ganti untuk Owner
drop policy if exists "publik_ubah_owner" on storage.objects;
create policy "publik_ubah_owner" on storage.objects for update to authenticated
  using (bucket_id = 'publik' and (select private.peran_saya()) = 'owner')
  with check (bucket_id = 'publik' and (select private.peran_saya()) = 'owner');

-- Policy hapus untuk Owner
drop policy if exists "publik_hapus_owner" on storage.objects;
create policy "publik_hapus_owner" on storage.objects for delete to authenticated
  using (bucket_id = 'publik' and (select private.peran_saya()) = 'owner');
