import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeStatus } from "@/components/BadgeStatus";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { TombolAksiWO } from "./TombolAksiWO";
import { BagianDataMasuk } from "./BagianDataMasuk";
import { BagianPenugasan } from "./BagianPenugasan";
import { BagianPengerjaan } from "./BagianPengerjaan";
import { LinimasaRiwayat } from "./LinimasaRiwayat";

export default async function HalamanRincianWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // Ambil detail work order lengkap
  const { data: wo, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      vehicles (*),
      customers (*),
      profiles!work_orders_kepala_mekanik_id_fkey (id, nama),
      work_order_mekanik (mekanik (id, nama)),
      work_order_photos (*),
      billing_items (id, nama_item, jenis, jumlah, harga_dipakai),
      invoices (id, nomor, status_bayar, total),
      wo_status_history (*, profiles (nama))
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !wo) {
    notFound();
  }

  // Buat signed URLs untuk semua foto di WO ini (PRD 11.3)
  const pathsFoto = (wo.work_order_photos || []).map((p) => p.path);
  const mapSignedUrl: Record<string, string> = {};

  if (pathsFoto.length > 0) {
    const { data: signedData } = await supabase.storage
      .from("foto-wo")
      .createSignedUrls(pathsFoto, 600);

    if (signedData) {
      for (const item of signedData) {
        if (item.path && item.signedUrl) {
          mapSignedUrl[item.path] = item.signedUrl;
        }
      }
    }
  }

  // Pengelompokan Foto
  const fotoStnkRaw = wo.work_order_photos?.find((p) => p.jenis === "stnk");
  const fotoStnk = fotoStnkRaw
    ? { path: fotoStnkRaw.path, signedUrl: mapSignedUrl[fotoStnkRaw.path] || "" }
    : null;

  const fotoKondisiAwal = (wo.work_order_photos || [])
    .filter((p) => p.jenis === "kondisi_awal")
    .map((p) => ({ path: p.path, signedUrl: mapSignedUrl[p.path] || "" }));

  const fotoPengerjaan = (wo.work_order_photos || [])
    .filter((p) => p.jenis === "pengerjaan")
    .map((p) => ({ path: p.path, signedUrl: mapSignedUrl[p.path] || "" }));

  const fotoKondisiAkhir = (wo.work_order_photos || [])
    .filter((p) => p.jenis === "kondisi_akhir")
    .map((p) => ({ path: p.path, signedUrl: mapSignedUrl[p.path] || "" }));

  // Ambil data mekanik tim untuk penugasan
  const { data: mekanikTimList } = await supabase
    .from("mekanik")
    .select("id, nama")
    .eq("kepala_mekanik_id", wo.kepala_mekanik_id)
    .eq("aktif", true);

  // Ambil beban kerja aktif per mekanik
  const { data: activeAssignments } = await supabase
    .from("work_order_mekanik")
    .select("mekanik_id, work_orders!inner(status)")
    .in("work_orders.status", ["menunggu", "dikerjakan", "tertunda"]);

  const bebanMap: Record<string, number> = {};
  for (const asg of activeAssignments ?? []) {
    bebanMap[asg.mekanik_id] = (bebanMap[asg.mekanik_id] || 0) + 1;
  }

  const daftarMekanikTim = (mekanikTimList ?? [])
    .map((m) => ({
      id: m.id,
      nama: m.nama,
      woAktif: bebanMap[m.id] || 0,
    }))
    .sort((a, b) => a.woAktif - b.woAktif);

  // Ambil semua kepala mekanik (untuk opsi pindah tim)
  const { data: semuaTim } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // Mekanik yang saat ini ditugaskan di WO
  const mekanikDitugaskan = (wo.work_order_mekanik || [])
    .map((wm: any) => wm.mekanik)
    .filter(Boolean);

  // Indikator Terlambat (PRD 6.6)
  const hariIniStr = new Date().toISOString().split("T")[0];
  const isTerlambat =
    wo.estimasi_selesai &&
    wo.estimasi_selesai < hariIniStr &&
    ["menunggu", "dikerjakan", "tertunda"].includes(wo.status);

  // Sort riwayat status terbaru di atas
  const riwayatStatus = (wo.wo_status_history || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-6">
      {/* Header Rincian WO */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/work-orders">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold font-mono text-text">{wo.nomor}</h1>
              <BadgeStatus status={wo.status} />
              {isTerlambat && (
                <Badge
                  variant="destructive"
                  className="bg-danger text-white flex items-center gap-1 font-semibold"
                >
                  <Clock className="size-3" />
                  Terlambat
                </Badge>
              )}
            </div>
            <p className="text-sm text-text-muted mt-0.5">
              {wo.vehicles?.plat} · {wo.vehicles?.merek_model} ({wo.customers?.nama})
            </p>
          </div>
        </div>

        {/* Tombol Aksi Status sesuai Peran dan Alur PRD 7.2 */}
        <TombolAksiWO
          workOrderId={wo.id}
          status={wo.status}
          kepalaMekanikId={wo.kepala_mekanik_id}
          peranSaya={profil.peran}
          userId={profil.id}
          mekanikCount={mekanikDitugaskan.length}
          adaEstimasi={Boolean(wo.estimasi_selesai)}
          itemCount={(wo.billing_items || []).length}
          invoiceStatus={wo.invoices?.status_bayar}
          fotoAkhirCount={fotoKondisiAkhir.length}
        />
      </div>

      {/* Tab Work Order (Rincian | Tagihan) */}
      <TabWorkOrder id={id} />

      {/* Bagian A. Data Masuk */}
      <BagianDataMasuk
        workOrderId={wo.id}
        status={wo.status}
        customer={wo.customers}
        vehicle={wo.vehicles}
        odometer={wo.odometer}
        keluhan={wo.keluhan}
        diagnosis={wo.diagnosis}
        peranSaya={profil.peran}
        kepalaMekanikId={wo.kepala_mekanik_id}
        userId={profil.id}
        fotoStnk={fotoStnk}
        fotoKondisiAwal={fotoKondisiAwal}
      />

      {/* Bagian B. Penugasan */}
      <BagianPenugasan
        workOrderId={wo.id}
        status={wo.status}
        kepalaMekanikId={wo.kepala_mekanik_id}
        kepalaMekanikNama={wo.profiles?.nama || "Tim"}
        estimasiSelesai={wo.estimasi_selesai}
        mekanikDitugaskan={mekanikDitugaskan}
        peranSaya={profil.peran}
        userId={profil.id}
        daftarMekanikTim={daftarMekanikTim}
        daftarSemuaTim={semuaTim || []}
      />

      {/* Bagian C. Pengerjaan */}
      <BagianPengerjaan
        workOrderId={wo.id}
        status={wo.status}
        kepalaMekanikId={wo.kepala_mekanik_id}
        peranSaya={profil.peran}
        userId={profil.id}
        items={wo.billing_items || []}
        fotoPengerjaan={fotoPengerjaan}
        fotoKondisiAkhir={fotoKondisiAkhir}
      />

      {/* Linimasa Riwayat Status */}
      <LinimasaRiwayat riwayat={riwayatStatus} />
    </div>
  );
}
