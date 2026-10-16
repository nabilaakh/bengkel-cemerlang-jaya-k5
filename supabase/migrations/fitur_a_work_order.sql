-- =============================================================
-- Fitur A: Work Order
-- PRD 7.2, 9.2, 9.4, Bab 11
-- =============================================================

-- 1. Fungsi buat_work_order (PRD 9.2)
create or replace function public.buat_work_order(
  p_vehicle_id uuid,
  p_kepala_mekanik_id uuid,
  p_odometer int,
  p_keluhan text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_customer_id uuid;
  v_periode text;
  v_urut int;
  v_nomor text;
  v_wo_id uuid;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran not in ('admin', 'owner') then
    raise exception 'Hanya Admin atau Owner yang boleh membuat Work Order';
  end if;

  -- Validasi input
  if p_vehicle_id is null then
    raise exception 'Kendaraan wajib dipilih';
  end if;

  if p_kepala_mekanik_id is null then
    raise exception 'Tim Kepala Mekanik wajib dipilih';
  end if;

  if p_odometer is null or p_odometer < 0 then
    raise exception 'Odometer wajib diisi dan tidak boleh negatif';
  end if;

  if coalesce(trim(p_keluhan), '') = '' then
    raise exception 'Keluhan wajib diisi';
  end if;

  -- Ambil customer_id dari kendaraan
  select customer_id into v_customer_id
  from public.vehicles
  where id = p_vehicle_id;

  if not found then
    raise exception 'Kendaraan tidak ditemukan';
  end if;

  -- Pastikan kepala mekanik valid dan aktif
  if not exists (
    select 1 from public.profiles
    where id = p_kepala_mekanik_id and role = 'kepala_mekanik' and aktif
  ) then
    raise exception 'Kepala Mekanik tidak valid atau tidak aktif';
  end if;

  -- Penomoran WO: WO-YYMM-0001
  v_periode := to_char(now(), 'YYMM');
  v_urut := private.nomor_berikut('WO', v_periode);
  v_nomor := 'WO-' || v_periode || '-' || lpad(v_urut::text, 4, '0');

  v_wo_id := gen_random_uuid();

  insert into public.work_orders (
    id, nomor, vehicle_id, customer_id, kepala_mekanik_id,
    odometer, keluhan, status, dibuat_oleh
  ) values (
    v_wo_id, v_nomor, p_vehicle_id, v_customer_id, p_kepala_mekanik_id,
    p_odometer, p_keluhan, 'menunggu', auth.uid()
  );

  -- Catat riwayat status awal
  insert into public.wo_status_history (
    work_order_id, dari_status, ke_status, catatan, oleh
  ) values (
    v_wo_id, null, 'menunggu', 'Work Order dibuat', auth.uid()
  );

  return v_wo_id;
end;
$$;

revoke all on function public.buat_work_order(uuid, uuid, int, text) from public, anon;
grant execute on function public.buat_work_order(uuid, uuid, int, text) to authenticated;


-- 2. Fungsi tugaskan_mekanik (PRD 9.2)
create or replace function public.tugaskan_mekanik(
  p_wo uuid,
  p_mekanik uuid[],
  p_estimasi date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_count int;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran not in ('kepala_mekanik', 'owner') then
    raise exception 'Hanya Kepala Mekanik atau Owner yang boleh menugaskan mekanik';
  end if;

  -- Kunci baris WO
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  -- Kepala mekanik hanya boleh WO timnya
  if v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid() then
    raise exception 'Hanya Kepala Mekanik tim yang menangani yang boleh menugaskan mekanik';
  end if;

  -- Status harus menunggu
  if v_wo.status <> 'menunggu' then
    raise exception 'Penugasan mekanik hanya boleh dilakukan saat status menunggu';
  end if;

  -- Validasi tanggal estimasi
  if p_estimasi is null or p_estimasi < current_date then
    raise exception 'Estimasi selesai wajib diisi dan tidak boleh sebelum hari ini';
  end if;

  -- Validasi jumlah mekanik (1 sampai 3)
  if p_mekanik is null or coalesce(array_length(p_mekanik, 1), 0) < 1 then
    raise exception 'Minimal 1 mekanik harus ditugaskan';
  end if;

  if array_length(p_mekanik, 1) > 3 then
    raise exception 'Maksimal 3 mekanik yang boleh ditugaskan';
  end if;

  -- Pastikan semua mekanik aktif dan berada di tim yang menangani WO
  select count(*) into v_count
  from public.mekanik
  where id = any(p_mekanik)
    and kepala_mekanik_id = v_wo.kepala_mekanik_id
    and aktif;

  if v_count <> array_length(p_mekanik, 1) then
    raise exception 'Semua mekanik harus aktif dan berasal dari tim yang menangani Work Order ini';
  end if;

  -- Perbarui estimasi selesai
  update public.work_orders
  set estimasi_selesai = p_estimasi,
      updated_at = now()
  where id = p_wo;

  -- Sinkronisasi work_order_mekanik
  delete from public.work_order_mekanik
  where work_order_id = p_wo;

  insert into public.work_order_mekanik (work_order_id, mekanik_id)
  select p_wo, unnest(p_mekanik);
end;
$$;

revoke all on function public.tugaskan_mekanik(uuid, uuid[], date) from public, anon;
grant execute on function public.tugaskan_mekanik(uuid, uuid[], date) to authenticated;


-- 3. Fungsi ubah_status_wo (PRD 7.2 & 9.2)
create or replace function public.ubah_status_wo(
  p_wo uuid,
  p_status text,
  p_catatan text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peran text;
  v_wo record;
  v_dari text;
  v_count int;
  v_status_bayar text;
  v_item record;
  v_stok_lama int;
  v_stok_baru int;
begin
  -- Periksa peran
  v_peran := private.peran_saya();
  if v_peran is null then
    raise exception 'Pengguna tidak memiliki hak akses aktif';
  end if;

  -- Kunci baris WO
  select * into v_wo
  from public.work_orders
  where id = p_wo
  for update;

  if not found then
    raise exception 'Work Order tidak ditemukan';
  end if;

  v_dari := v_wo.status;

  -- Validasi status tujuan
  if p_status not in ('menunggu', 'dikerjakan', 'tertunda', 'selesai', 'siap_diambil', 'diambil', 'dibatalkan') then
    raise exception 'Status tidak valid: %', p_status;
  end if;

  -- Aturan Perpindahan Status PRD 7.2
  if v_dari = 'menunggu' and p_status = 'dikerjakan' then
    if v_peran not in ('owner', 'kepala_mekanik')
       or (v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh memulai pengerjaan';
    end if;

    select count(*) into v_count from public.work_order_mekanik where work_order_id = p_wo;
    if v_count < 1 then
      raise exception 'Minimal 1 mekanik harus ditugaskan sebelum memulai pengerjaan';
    end if;

    if v_wo.estimasi_selesai is null then
      raise exception 'Estimasi selesai wajib diisi sebelum memulai pengerjaan';
    end if;

  elsif v_dari = 'dikerjakan' and p_status = 'tertunda' then
    if v_peran not in ('owner', 'kepala_mekanik')
       or (v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh menunda pengerjaan';
    end if;

    if coalesce(trim(p_catatan), '') = '' then
      raise exception 'Catatan penundaan wajib diisi';
    end if;

  elsif v_dari = 'tertunda' and p_status = 'dikerjakan' then
    if v_peran not in ('owner', 'kepala_mekanik')
       or (v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh melanjutkan pengerjaan';
    end if;

  elsif v_dari = 'dikerjakan' and p_status = 'selesai' then
    if v_peran not in ('owner', 'kepala_mekanik')
       or (v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh menyelesaikan pengerjaan';
    end if;

    select count(*) into v_count from public.billing_items where work_order_id = p_wo;
    if v_count < 1 then
      raise exception 'Catat minimal 1 jasa atau spare part sebelum menyelesaikan pengerjaan';
    end if;

  elsif v_dari = 'selesai' and p_status = 'siap_diambil' then
    if v_peran not in ('owner', 'kepala_mekanik')
       or (v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh meluluskan QC';
    end if;

  elsif v_dari = 'selesai' and p_status = 'dikerjakan' then
    if v_peran not in ('owner', 'kepala_mekanik')
       or (v_peran = 'kepala_mekanik' and v_wo.kepala_mekanik_id <> auth.uid()) then
      raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh mengembalikan pengerjaan';
    end if;

    if coalesce(trim(p_catatan), '') = '' then
      raise exception 'Catatan QC gagal wajib diisi';
    end if;

  elsif v_dari = 'siap_diambil' and p_status = 'diambil' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh menyerahkan mobil';
    end if;

    select status_bayar into v_status_bayar from public.invoices where work_order_id = p_wo;
    if not found or v_status_bayar <> 'lunas' then
      raise exception 'Mobil hanya bisa diserahkan setelah invoice lunas';
    end if;

    select count(*) into v_count
    from public.work_order_photos
    where work_order_id = p_wo and jenis = 'kondisi_akhir';

    if v_count < 1 then
      raise exception 'Minimal 1 foto kondisi akhir wajib diunggah sebelum mobil diserahkan';
    end if;

  elsif v_dari in ('menunggu', 'dikerjakan', 'tertunda') and p_status = 'dibatalkan' then
    if v_peran not in ('admin', 'owner') then
      raise exception 'Hanya Admin atau Owner yang boleh membatalkan Work Order';
    end if;

    if coalesce(trim(p_catatan), '') = '' then
      raise exception 'Alasan pembatalan wajib diisi';
    end if;

    -- Kembalikan stok spare part yang sudah tercatat
    for v_item in
      select bi.item_id, bi.jumlah
      from public.billing_items bi
      where bi.work_order_id = p_wo and bi.jenis = 'part'
    loop
      select stok into v_stok_lama
      from public.inventory_items
      where id = v_item.item_id
      for update;

      update public.inventory_items
      set stok = stok + v_item.jumlah,
          updated_at = now()
      where id = v_item.item_id
      returning stok into v_stok_baru;

      insert into public.stock_movements (
        item_id, jenis, jumlah, stok_sesudah, keterangan, work_order_id, dicatat_oleh
      ) values (
        v_item.item_id, 'kembali', v_item.jumlah, v_stok_baru,
        'Pengembalian stok pembatalan WO: ' || p_catatan,
        p_wo, auth.uid()
      );
    end loop;

  else
    raise exception 'Perpindahan status dari % ke % tidak diizinkan', v_dari, p_status;
  end if;

  -- Perbarui status WO
  update public.work_orders
  set status = p_status,
      catatan_status = coalesce(p_catatan, catatan_status),
      selesai_at = case when p_status = 'selesai' then coalesce(selesai_at, now()) else selesai_at end,
      diambil_at = case when p_status = 'diambil' then now() else diambil_at end,
      updated_at = now()
  where id = p_wo;

  -- Catat riwayat status
  insert into public.wo_status_history (
    work_order_id, dari_status, ke_status, catatan, oleh
  ) values (
    p_wo, v_dari, p_status, p_catatan, auth.uid()
  );
end;
$$;

revoke all on function public.ubah_status_wo(uuid, text, text) from public, anon;
grant execute on function public.ubah_status_wo(uuid, text, text) to authenticated;


-- 4. Trigger jaga_wo (PRD 9.4)
create or replace function private.jaga_wo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_peran text;
begin
  if current_user = 'authenticated' then
    v_peran := private.peran_saya();

    -- Status tidak boleh diubah langsung via update
    if new.status is distinct from old.status then
      raise exception 'Status Work Order hanya boleh diubah melalui fungsi ubah_status_wo';
    end if;

    -- Kolom-kolom terkunci yang tidak boleh diubah lewat update langsung
    if new.nomor is distinct from old.nomor
       or new.vehicle_id is distinct from old.vehicle_id
       or new.customer_id is distinct from old.customer_id
       or new.diskon is distinct from old.diskon
       or new.alasan_diskon is distinct from old.alasan_diskon
       or new.selesai_at is distinct from old.selesai_at
       or new.diambil_at is distinct from old.diambil_at
       or new.dibuat_oleh is distinct from old.dibuat_oleh
       or new.created_at is distinct from old.created_at then
      raise exception 'Kolom ini tidak boleh diubah secara langsung';
    end if;

    if old.status = 'menunggu' then
      if new.diagnosis is distinct from old.diagnosis then
        raise exception 'Diagnosis hanya boleh diisi saat status dikerjakan atau tertunda';
      end if;

      if (new.keluhan is distinct from old.keluhan
          or new.odometer is distinct from old.odometer
          or new.kepala_mekanik_id is distinct from old.kepala_mekanik_id)
         and v_peran not in ('admin', 'owner') then
        raise exception 'Hanya Admin atau Owner yang boleh mengubah data masuk saat status menunggu';
      end if;

    elsif old.status in ('dikerjakan', 'tertunda') then
      if new.keluhan is distinct from old.keluhan
         or new.odometer is distinct from old.odometer
         or new.kepala_mekanik_id is distinct from old.kepala_mekanik_id then
        raise exception 'Keluhan, odometer, dan tim tidak boleh diubah setelah pengerjaan dimulai';
      end if;

      if new.diagnosis is distinct from old.diagnosis then
        if v_peran not in ('owner', 'kepala_mekanik')
           or (v_peran = 'kepala_mekanik' and old.kepala_mekanik_id <> auth.uid()) then
          raise exception 'Hanya Kepala Mekanik tim yang menangani atau Owner yang boleh mengisi diagnosis';
        end if;
      end if;

    else
      if new.keluhan is distinct from old.keluhan
         or new.odometer is distinct from old.odometer
         or new.kepala_mekanik_id is distinct from old.kepala_mekanik_id
         or new.diagnosis is distinct from old.diagnosis then
        raise exception 'Work Order tidak dapat diubah pada status %', old.status;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_wo on public.work_orders;
create trigger jaga_wo
before update on public.work_orders
for each row execute function private.jaga_wo();


-- 5. Bucket foto-wo dan Policy Storage (PRD Bab 11)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-wo', 'foto-wo', false, 1048576, array['image/webp', 'image/jpeg']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/webp', 'image/jpeg']::text[];

-- Hapus policy lama jika ada sebelum membuat baru
drop policy if exists "foto_wo_baca" on storage.objects;
drop policy if exists "foto_wo_unggah_awal" on storage.objects;
drop policy if exists "foto_wo_unggah_akhir" on storage.objects;
drop policy if exists "foto_wo_unggah_pengerjaan" on storage.objects;
drop policy if exists "foto_wo_hapus" on storage.objects;

-- Baca foto: semua akun login yang aktif
create policy "foto_wo_baca" on storage.objects for select to authenticated
using (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) is not null
);

-- Unggah stnk & kondisi_awal: Admin dan Owner saat WO menunggu
create policy "foto_wo_unggah_awal" on storage.objects for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('admin', 'owner')
  and (storage.foldername(name))[2] in ('stnk', 'kondisi_awal')
  and exists (
    select 1 from public.work_orders
    where id = (storage.foldername(name))[1]::uuid
      and status = 'menunggu'
  )
);

-- Unggah kondisi_akhir: Admin dan Owner saat WO siap_diambil
create policy "foto_wo_unggah_akhir" on storage.objects for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) in ('admin', 'owner')
  and (storage.foldername(name))[2] = 'kondisi_akhir'
  and exists (
    select 1 from public.work_orders
    where id = (storage.foldername(name))[1]::uuid
      and status = 'siap_diambil'
  )
);

-- Unggah pengerjaan: Kepala Mekanik tim WO saat dikerjakan
create policy "foto_wo_unggah_pengerjaan" on storage.objects for insert to authenticated
with check (
  bucket_id = 'foto-wo'
  and (
    ((select private.peran_saya()) = 'owner')
    or (
      (select private.peran_saya()) = 'kepala_mekanik'
      and exists (
        select 1 from public.work_orders
        where id = (storage.foldername(name))[1]::uuid
          and status = 'dikerjakan'
          and kepala_mekanik_id = (select auth.uid())
      )
    )
  )
  and (storage.foldername(name))[2] = 'pengerjaan'
);

-- Hapus foto: hanya Owner
create policy "foto_wo_hapus" on storage.objects for delete to authenticated
using (
  bucket_id = 'foto-wo'
  and (select private.peran_saya()) = 'owner'
);
