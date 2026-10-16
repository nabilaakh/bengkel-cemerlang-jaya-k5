import { notFound, redirect } from "next/navigation";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import {
  KomponenTagihan,
  type ItemTagihanTampil,
  type InvoiceTampil,
} from "./KomponenTagihan";

export default async function TagihanWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // Ambil detail work order, relasi kendaraan, pelanggan, baris tagihan, dan invoice
  const { data: wo, error } = await supabase
    .from("work_orders")
    .select(`
      id, nomor, status, odometer, keluhan, estimasi_selesai, diskon, alasan_diskon, kepala_mekanik_id,
      vehicles (plat, merek_model),
      customers (nama, telepon),
      profiles!work_orders_kepala_mekanik_id_fkey (id, nama),
      billing_items (
        id, item_id, nama_item, jenis, jumlah, harga_master, harga_dipakai, alasan_penyesuaian, disesuaikan_at,
        profiles!billing_items_disesuaikan_oleh_fkey (nama)
      ),
      invoices (
        id, nomor, subtotal, diskon, total, terbayar, status_bayar, diterbitkan_at,
        payments (
          id, metode, jumlah, created_at,
          profiles!payments_dicatat_oleh_fkey (nama)
        )
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !wo) {
    notFound();
  }

  // PRD 2.3 & 4: Kepala Mekanik hanya boleh melihat tagihan WO timnya
  if (profil.peran === "kepala_mekanik" && wo.kepala_mekanik_id !== profil.id) {
    redirect("/work-orders");
  }

  // Jika login sebagai Owner, ambil data harga modal dari tabel rahasia billing_item_costs
  const mapHargaModal: Record<string, number> = {};
  if (profil.peran === "owner") {
    const itemIds = (wo.billing_items || []).map((bi) => bi.id);
    if (itemIds.length > 0) {
      const { data: costs } = await supabase
        .from("billing_item_costs")
        .select("billing_item_id, harga_modal")
        .in("billing_item_id", itemIds);

      if (costs) {
        for (const c of costs) {
          mapHargaModal[c.billing_item_id] = c.harga_modal;
        }
      }
    }
  }

  // Ambil daftar inventory aktif untuk dropdown dialog tambah item
  const { data: inventoryList } = await supabase
    .from("inventory_items")
    .select("id, kode, jenis, nama, harga_jual, stok")
    .eq("aktif", true)
    .order("nama");

  // Transformasi Item Tagihan
  const daftarItems: ItemTagihanTampil[] = (wo.billing_items || []).map((it) => {
    // profiles bisa berupa object atau null
    const pengubah = it.profiles as { nama: string } | null;
    return {
      id: it.id,
      item_id: it.item_id,
      nama_item: it.nama_item,
      jenis: it.jenis,
      jumlah: it.jumlah,
      harga_master: it.harga_master,
      harga_dipakai: it.harga_dipakai,
      alasan_penyesuaian: it.alasan_penyesuaian,
      disesuaikan_at: it.disesuaikan_at,
      disesuaikan_oleh_nama: pengubah?.nama ?? null,
      harga_modal: mapHargaModal[it.id] ?? 0,
    };
  });

  // Transformasi Data Invoice (jika sudah terbit)
  let invoiceData: InvoiceTampil | null = null;
  const rawInvoice = wo.invoices as unknown as
    | {
        id: string;
        nomor: string;
        subtotal: number;
        diskon: number;
        total: number;
        terbayar: number;
        status_bayar: "belum_bayar" | "sebagian" | "lunas";
        diterbitkan_at: string;
        payments: Array<{
          id: string;
          metode: string;
          jumlah: number;
          created_at: string;
          profiles: { nama: string } | null;
        }>;
      }
    | null;

  if (rawInvoice && rawInvoice.id) {
    invoiceData = {
      id: rawInvoice.id,
      nomor: rawInvoice.nomor,
      subtotal: rawInvoice.subtotal,
      diskon: rawInvoice.diskon,
      total: rawInvoice.total,
      terbayar: rawInvoice.terbayar,
      status_bayar: rawInvoice.status_bayar,
      diterbitkan_at: rawInvoice.diterbitkan_at,
      payments: (rawInvoice.payments || []).map((p) => ({
        id: p.id,
        metode: p.metode,
        jumlah: p.jumlah,
        created_at: p.created_at,
        dicatat_oleh_nama: p.profiles?.nama ?? null,
      })),
    };
  }

  const kepalaMekanikProfile = wo.profiles as { id: string; nama: string } | null;
  const vehicleObj = wo.vehicles as { plat: string; merek_model: string } | null;
  const customerObj = wo.customers as { nama: string; telepon: string } | null;

  return (
    <KomponenTagihan
      workOrder={{
        id: wo.id,
        nomor: wo.nomor,
        status: wo.status,
        odometer: wo.odometer,
        keluhan: wo.keluhan,
        estimasi_selesai: wo.estimasi_selesai,
        diskon: wo.diskon,
        alasan_diskon: wo.alasan_diskon,
        kepala_mekanik_id: wo.kepala_mekanik_id,
        kepala_mekanik_nama: kepalaMekanikProfile?.nama || "-",
        customer_nama: customerObj?.nama || "-",
        customer_telepon: customerObj?.telepon || "-",
        plat: vehicleObj?.plat || "-",
        merek_model: vehicleObj?.merek_model || "-",
      }}
      items={daftarItems}
      invoice={invoiceData}
      daftarInventory={inventoryList || []}
      peranSaya={profil.peran}
      userId={profil.id}
    />
  );
}
