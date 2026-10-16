"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  Car,
  CheckCircle2,
  Receipt,
  DollarSign,
  PlusCircle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/format";
import { KartuKPI } from "./KartuKPI";
import { GrafikTrenHarian, type TitikTrenKeuangan } from "./GrafikTrenHarian";
import { GrafikWoStatusDonut } from "./GrafikWoStatusDonut";
import { GrafikTopItem, type TopItemData } from "./GrafikTopItem";

export interface RingkasanAdmin {
  mobil_masuk_hari_ini: number;
  siap_diambil: number;
  perlu_ditagih: number;
  pendapatan_hari_ini: number;
  pendapatan: number;
  pendapatan_sebelumnya: number;
}

interface DashboardAdminProps {
  ringkasan: RingkasanAdmin;
  trenPendapatan: TitikTrenKeuangan[];
  woPerStatus: { status: string; jumlah: number }[];
  topPart: TopItemData[];
  topJasa: TopItemData[];
}

export function DashboardAdmin({
  ringkasan,
  trenPendapatan,
  woPerStatus,
  topPart,
  topJasa,
}: DashboardAdminProps) {
  const router = useRouter();
  const [cariPlat, setCariPlat] = React.useState("");

  function handleCariPlat(e: React.FormEvent) {
    e.preventDefault();
    if (cariPlat.trim()) {
      router.push(`/work-orders?q=${encodeURIComponent(cariPlat.trim())}`);
    } else {
      router.push("/work-orders");
    }
  }

  return (
    <div className="space-y-6">
      {/* Aksi Cepat Admin (PRD 12.3: Tombol + WO dan Kolom Cari Plat) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/work-orders/baru">
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary-strong">
              <PlusCircle className="size-4" />
              <span>+ Work Order</span>
            </Button>
          </Link>
          <span className="text-xs text-text-muted hidden md:inline">
            Catat pendaftaran mobil baru yang datang ke meja depan
          </span>
        </div>

        <form onSubmit={handleCariPlat} className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={cariPlat}
              onChange={(e) => setCariPlat(e.target.value)}
              placeholder="Cari plat nomor (B 1234 CD)..."
              className="pl-9 text-xs"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="shrink-0 text-xs">
            Cari
          </Button>
        </form>
      </div>

      {/* 4 Kartu KPI Admin (PRD 12.3) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuKPI
          judul="Mobil Masuk Hari Ini"
          nilai={ringkasan.mobil_masuk_hari_ini || 0}
          ikon={Car}
          subteks="Registrasi kedatangan hari ini"
          tautan="/work-orders"
        />

        <KartuKPI
          judul="Siap Diambil"
          nilai={ringkasan.siap_diambil || 0}
          ikon={CheckCircle2}
          subteks="Lulus QC, siap serah terima"
          tautan="/work-orders?status=siap_diambil"
        />

        <KartuKPI
          judul="Perlu Ditagih"
          nilai={ringkasan.perlu_ditagih || 0}
          ikon={Receipt}
          subteks="Siap diambil & belum lunas"
          tautan="/work-orders?status=siap_diambil"
          balikWarna={true}
        />

        <KartuKPI
          judul="Pendapatan Periode Ini"
          nilai={rupiah(ringkasan.pendapatan || 0)}
          ikon={DollarSign}
          nilaiSekarang={ringkasan.pendapatan || 0}
          nilaiSebelumnya={ringkasan.pendapatan_sebelumnya || 0}
          subteks={`Hari ini: ${rupiah(ringkasan.pendapatan_hari_ini || 0)}`}
          tautan="/work-orders"
        />
      </div>

      {/* Grid Grafik Admin: Tren Pendapatan & Donut Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikTrenHarian
          judul="Tren Pendapatan Harian"
          keterangan="Pendapatan harian dari jasa pengerjaan dan penjualan spare part"
          tipe="keuangan"
          dataKeuangan={trenPendapatan}
          tampilkanLaba={false}
          tautanSumber="/work-orders"
        />

        <GrafikWoStatusDonut
          data={woPerStatus}
          judul="Status Pengerjaan Mobil"
          keterangan="Pantauan kendaraan dari penerimaan hingga serah terima"
        />
      </div>

      {/* Grid Grafik Baris 2: Item Terlaris */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrafikTopItem
          dataPart={topPart}
          dataJasa={topJasa}
          judul="5 Item Terlaris"
          keterangan="Spare part dan jasa yang paling sering digunakan pada periode ini"
        />
      </div>
    </div>
  );
}
