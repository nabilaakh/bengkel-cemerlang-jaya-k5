-- =============================================================
-- Fitur D: Trigger Catat Audit & Proteksi Audit Log (PRD 9.4 & 6.13)
-- =============================================================

-- 1. Proteksi ketat: cegah UPDATE, DELETE, dan TRUNCATE pada audit_logs
revoke update, delete, truncate on table public.audit_logs from public, anon, authenticated;

create or replace function private.cegah_ubah_audit_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'audit_logs bersifat permanen dan tidak boleh diubah atau dihapus';
end;
$$;

drop trigger if exists jangan_ubah_audit_log on public.audit_logs;
create trigger jangan_ubah_audit_log
  before update or delete on public.audit_logs
  for each row execute function private.cegah_ubah_audit_log();

-- 2. Fungsi trigger catat_audit
create or replace function private.catat_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
  v_new jsonb := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end;
  v_pelaku_id uuid := auth.uid();
  v_pelaku_peran text;
  v_data_id text;
  v_alasan text;
begin
  -- Identifikasi peran pelaku
  if v_pelaku_id is not null then
    select p.role into v_pelaku_peran from public.profiles p where p.id = v_pelaku_id;
  end if;

  -- Ambil data_id (nomor WO/INV bila ada, atau ID data)
  v_data_id := coalesce(
    v_new->>'nomor',
    v_new->>'id',
    v_new->>'billing_item_id',
    v_new->>'item_id',
    v_old->>'nomor',
    v_old->>'id',
    v_old->>'billing_item_id',
    v_old->>'item_id'
  );

  -- Ambil alasan perubahan bila kolom alasan tersedia di tabel
  v_alasan := coalesce(
    v_new->>'alasan',
    v_new->>'alasan_penyesuaian',
    v_new->>'catatan_status',
    v_new->>'alasan_diskon',
    v_new->>'keterangan',
    v_old->>'alasan',
    v_old->>'alasan_penyesuaian',
    v_old->>'catatan_status',
    v_old->>'alasan_diskon',
    v_old->>'keterangan'
  );

  -- Tulis ke audit_logs
  insert into public.audit_logs (
    waktu,
    pelaku_id,
    pelaku_peran,
    aksi,
    tabel,
    data_id,
    sebelum,
    sesudah,
    alasan
  ) values (
    now(),
    v_pelaku_id,
    v_pelaku_peran,
    TG_OP,
    TG_TABLE_NAME,
    v_data_id,
    v_old,
    v_new,
    v_alasan
  );

  return coalesce(NEW, OLD);
end;
$$;

-- 3. Pasang trigger catat_audit pada 9 tabel sesuai PRD 9.4
drop trigger if exists catat_audit on public.work_orders;
create trigger catat_audit
  after insert or update or delete on public.work_orders
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.billing_items;
create trigger catat_audit
  after insert or update or delete on public.billing_items
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.billing_item_costs;
create trigger catat_audit
  after insert or update or delete on public.billing_item_costs
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.inventory_items;
create trigger catat_audit
  after insert or update or delete on public.inventory_items
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.inventory_costs;
create trigger catat_audit
  after insert or update or delete on public.inventory_costs
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.invoices;
create trigger catat_audit
  after insert or update or delete on public.invoices
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.payments;
create trigger catat_audit
  after insert or update or delete on public.payments
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.stock_movements;
create trigger catat_audit
  after insert or update or delete on public.stock_movements
  for each row execute function private.catat_audit();

drop trigger if exists catat_audit on public.profiles;
create trigger catat_audit
  after insert or update or delete on public.profiles
  for each row execute function private.catat_audit();
