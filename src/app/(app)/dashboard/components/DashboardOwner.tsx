import {
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { rupiah } from "@/lib/format";
import { KartuKPI } from "./KartuKPI";
import { GrafikTrenHarian, type TitikTrenKeuangan } from "./GrafikTrenHarian";
import { GrafikWoStatusDonut } from "./GrafikWoStatusDonut";
import { GrafikBebanMekanik, type BebanMekanikItem } from "./GrafikBebanMekanik";
import { GrafikTopItem, type TopItemData } from "./GrafikTopItem";

export interface RingkasanOwner {
  pendapatan: number;
  pendapatan_sebelumnya: number;
  laba_kotor: number;
  laba_kotor_sebelumnya: number;
  margin_persen: number;
  wo_aktif: number;
  wo_terlambat: number;
  piutang: number;
}

interface DashboardOwnerProps {
  ringkasan: RingkasanOwner;
  trenKeuangan: TitikTrenKeuangan[];
  woPerStatus: { status: string; jumlah: number }[];
  bebanMekanik: BebanMekanikItem[];
  topPart: TopItemData[];
  topJasa: TopItemData[];
}

export function DashboardOwner({
  ringkasan,
  trenKeuangan,
  woPerStatus,
  bebanMekanik,
  topPart,
  topJasa,
}: DashboardOwnerProps) {
  return (
    <div className="space-y-6">
      {/* 6 Kartu KPI Owner (PRD 12.2) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KartuKPI
          judul="Pendapatan"
          nilai={rupiah(ringkasan.pendapatan || 0)}
          ikon={DollarSign}
          nilaiSekarang={ringkasan.pendapatan || 0}
          nilaiSebelumnya={ringkasan.pendapatan_sebelumnya || 0}
          tautan="/laporan-laba"
        />

        <KartuKPI
          judul="Laba Kotor"
          nilai={rupiah(ringkasan.laba_kotor || 0)}
          ikon={TrendingUp}
          nilaiSekarang={ringkasan.laba_kotor || 0}
          nilaiSebelumnya={ringkasan.laba_kotor_sebelumnya || 0}
          tautan="/laporan-laba"
        />

        <KartuKPI
          judul="Margin Kotor"
          nilai={`${ringkasan.margin_persen || 0}%`}
          ikon={Percent}
          subteks="Rasio laba kotor terhadap omset"
          tautan="/laporan-laba"
        />

        <KartuKPI
          judul="WO Aktif"
          nilai={ringkasan.wo_aktif || 0}
          ikon={Clock}
          subteks="Menunggu s/d Siap Diambil"
          tautan="/work-orders"
        />

        <KartuKPI
          judul="WO Terlambat"
          nilai={ringkasan.wo_terlambat || 0}
          ikon={AlertTriangle}
          subteks={
            ringkasan.wo_terlambat > 0
              ? `${ringkasan.wo_terlambat} mobil lewat estimasi`
              : "Semua pengerjaan tepat waktu"
          }
          tautan="/work-orders"
          balikWarna={true}
        />

        <KartuKPI
          judul="Total Piutang"
          nilai={rupiah(ringkasan.piutang || 0)}
          ikon={Receipt}
          subteks="Invoice belum lunas"
          tautan="/work-orders"
        />
      </div>

      {/* Grid Grafik Baris 1: Tren Keuangan & Status WO */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikTrenHarian
          judul="Tren Pendapatan & Laba Harian"
          keterangan="Pendapatan (jasa & spare part) serta estimasi laba kotor harian"
          tipe="keuangan"
          dataKeuangan={trenKeuangan}
          tampilkanLaba={true}
          tautanSumber="/laporan-laba"
        />

        <GrafikWoStatusDonut
          data={woPerStatus}
          judul="Distribusi Status Work Order"
          keterangan="Komposisi pengerjaan seluruh kendaraan di bengkel"
        />
      </div>

      {/* Grid Grafik Baris 2: Beban Mekanik & Item Terlaris */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikBebanMekanik
          data={bebanMekanik}
          judul="Beban Kerja Mekanik (Semua Tim)"
          keterangan="Jumlah WO yang sedang dikerjakan dan selesai pada periode ini"
        />

        <GrafikTopItem
          dataPart={topPart}
          dataJasa={topJasa}
          judul="5 Item Terlaris"
          keterangan="Spare part dan jasa dengan penjualan tertinggi pada periode ini"
        />
      </div>
    </div>
  );
}
