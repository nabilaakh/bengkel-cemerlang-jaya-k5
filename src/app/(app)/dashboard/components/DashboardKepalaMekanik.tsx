import {
  Clock,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { KartuKPI } from "./KartuKPI";
import { GrafikTrenHarian, type TitikTrenKuantitas } from "./GrafikTrenHarian";
import { GrafikWoStatusDonut } from "./GrafikWoStatusDonut";
import { GrafikBebanMekanik, type BebanMekanikItem } from "./GrafikBebanMekanik";

export interface RingkasanKepalaMekanik {
  menunggu_ditugaskan: number;
  sedang_dikerjakan: number;
  menunggu_qc: number;
  terlambat: number;
  selesai_periode: number;
  selesai_sebelumnya: number;
}

interface DashboardKepalaMekanikProps {
  ringkasan: RingkasanKepalaMekanik;
  trenSelesai: TitikTrenKuantitas[];
  woPerStatus: { status: string; jumlah: number }[];
  bebanMekanik: BebanMekanikItem[];
}

export function DashboardKepalaMekanik({
  ringkasan,
  trenSelesai,
  woPerStatus,
  bebanMekanik,
}: DashboardKepalaMekanikProps) {
  return (
    <div className="space-y-6">
      {/* 4 Kartu KPI Kepala Mekanik (PRD 12.4) + Kartu Selesai Periode */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuKPI
          judul="Menunggu Ditugaskan"
          nilai={ringkasan.menunggu_ditugaskan || 0}
          ikon={Clock}
          subteks="WO baru, mekanik belum ditunjuk"
          tautan="/work-orders?status=menunggu"
        />

        <KartuKPI
          judul="Sedang Dikerjakan"
          nilai={ringkasan.sedang_dikerjakan || 0}
          ikon={Wrench}
          subteks="Mobil dalam proses pengerjaan tim"
          tautan="/work-orders?status=dikerjakan"
        />

        <KartuKPI
          judul="Menunggu QC"
          nilai={ringkasan.menunggu_qc || 0}
          ikon={ClipboardCheck}
          subteks="Pengerjaan tuntas, perlu uji kelayakan"
          tautan="/work-orders?status=selesai"
        />

        <KartuKPI
          judul="Pengerjaan Terlambat"
          nilai={ringkasan.terlambat || 0}
          ikon={AlertTriangle}
          subteks={
            ringkasan.terlambat > 0
              ? `${ringkasan.terlambat} mobil lewat estimasi selesai`
              : "Semua pengerjaan tepat waktu"
          }
          tautan="/work-orders"
          balikWarna={true}
        />
      </div>

      {/* Grid Grafik: Beban Mekanik Tim & Tren WO Selesai */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikBebanMekanik
          data={bebanMekanik}
          judul="Beban Mekanik Tim"
          keterangan="Penyebaran pengerjaan aktif dan mobil selesai per mekanik di tim"
        />

        <GrafikTrenHarian
          judul="Tren Work Order Selesai"
          keterangan="Jumlah kendaraan tim yang berhasil diselesaikan per hari"
          tipe="wo_selesai"
          dataKuantitas={trenSelesai}
          tautanSumber="/work-orders?status=selesai"
        />
      </div>

      {/* Grid Grafik Baris 2: Komposisi Status Tim */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikWoStatusDonut
          data={woPerStatus}
          judul="Status Antrean Tim"
          keterangan="Distribusi status pekerjaan khusus kendaraan yang ditugaskan ke tim ini"
        />
      </div>
    </div>
  );
}
