import { createClient } from "@/lib/supabase/server";
import { ambilProfilSaya } from "@/lib/profil";
import {
  PenyaringPeriode,
  type PeriodeDashboard,
} from "./components/PenyaringPeriode";
import { hitungRentangTanggal } from "./helper";
import { DashboardOwner, type RingkasanOwner } from "./components/DashboardOwner";
import { DashboardAdmin, type RingkasanAdmin } from "./components/DashboardAdmin";
import {
  DashboardKepalaMekanik,
  type RingkasanKepalaMekanik,
} from "./components/DashboardKepalaMekanik";
import { type BebanMekanikItem } from "./components/GrafikBebanMekanik";
import { type TopItemData } from "./components/GrafikTopItem";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const profil = await ambilProfilSaya();
  const { periode: rawPeriode } = await searchParams;

  const validPeriode: PeriodeDashboard[] = [
    "hari_ini",
    "7_hari",
    "30_hari",
    "bulan_ini",
  ];
  const periode: PeriodeDashboard = validPeriode.includes(
    rawPeriode as PeriodeDashboard,
  )
    ? (rawPeriode as PeriodeDashboard)
    : "bulan_ini";

  const { dari, sampai, label: labelPeriode } = hitungRentangTanggal(periode);

  const supabase = await createClient();

  // 1. Data Ringkasan KPI dan Distribusi Status WO (Semua peran)
  const [resRingkasan, resWoStatus] = await Promise.all([
    supabase.rpc("dashboard_ringkasan", {
      p_dari: dari,
      p_sampai: sampai,
    }),
    supabase.rpc("dashboard_wo_per_status"),
  ]);

  const rawRingkasan = (resRingkasan.data ?? {}) as Record<string, unknown>;
  const woPerStatus = (resWoStatus.data ?? []) as {
    status: string;
    jumlah: number;
  }[];

  // 2. Data khusus per peran
  if (profil.peran === "owner") {
    const [resPendapatan, resLaba, resBeban, resTopPart, resTopJasa] =
      await Promise.all([
        supabase.rpc("dashboard_pendapatan_harian", {
          p_dari: dari,
          p_sampai: sampai,
        }),
        supabase.rpc("dashboard_laba_harian", {
          p_dari: dari,
          p_sampai: sampai,
        }),
        supabase.rpc("dashboard_beban_mekanik", {
          p_dari: dari,
          p_sampai: sampai,
        }),
        supabase.rpc("dashboard_top_item", {
          p_dari: dari,
          p_sampai: sampai,
          p_jenis: "part",
        }),
        supabase.rpc("dashboard_top_item", {
          p_dari: dari,
          p_sampai: sampai,
          p_jenis: "jasa",
        }),
      ]);

    const labaMap = new Map(
      (resLaba.data ?? []).map((item) => [item.tanggal, item.laba]),
    );

    const trenKeuangan = (resPendapatan.data ?? []).map((item) => ({
      tanggal: item.tanggal,
      pendapatan_jasa: item.pendapatan_jasa,
      pendapatan_part: item.pendapatan_part,
      laba: labaMap.get(item.tanggal) ?? 0,
    }));

    const ringkasanOwner: RingkasanOwner = {
      pendapatan: Number(rawRingkasan.pendapatan ?? 0),
      pendapatan_sebelumnya: Number(rawRingkasan.pendapatan_sebelumnya ?? 0),
      laba_kotor: Number(rawRingkasan.laba_kotor ?? 0),
      laba_kotor_sebelumnya: Number(rawRingkasan.laba_kotor_sebelumnya ?? 0),
      margin_persen: Number(rawRingkasan.margin_persen ?? 0),
      wo_aktif: Number(rawRingkasan.wo_aktif ?? 0),
      wo_terlambat: Number(rawRingkasan.wo_terlambat ?? 0),
      piutang: Number(rawRingkasan.piutang ?? 0),
    };

    return (
      <div className="space-y-6 pb-12">
        {/* Header Dashboard Owner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">
              Dashboard Owner
            </h1>
            <p className="mt-1 text-xs text-text-muted">
              Halo, <span className="font-medium text-text">{profil.nama}</span> · Menampilkan performa periode {labelPeriode.toLowerCase()}
            </p>
          </div>
          <PenyaringPeriode periodeAktif={periode} />
        </div>

        <DashboardOwner
          ringkasan={ringkasanOwner}
          trenKeuangan={trenKeuangan}
          woPerStatus={woPerStatus}
          bebanMekanik={(resBeban.data ?? []) as BebanMekanikItem[]}
          topPart={(resTopPart.data ?? []) as TopItemData[]}
          topJasa={(resTopJasa.data ?? []) as TopItemData[]}
        />
      </div>
    );
  }

  if (profil.peran === "admin") {
    const [resPendapatan, resTopPart, resTopJasa] = await Promise.all([
      supabase.rpc("dashboard_pendapatan_harian", {
        p_dari: dari,
        p_sampai: sampai,
      }),
      supabase.rpc("dashboard_top_item", {
        p_dari: dari,
        p_sampai: sampai,
        p_jenis: "part",
      }),
      supabase.rpc("dashboard_top_item", {
        p_dari: dari,
        p_sampai: sampai,
        p_jenis: "jasa",
      }),
    ]);

    const trenPendapatan = (resPendapatan.data ?? []).map((item) => ({
      tanggal: item.tanggal,
      pendapatan_jasa: item.pendapatan_jasa,
      pendapatan_part: item.pendapatan_part,
    }));

    const ringkasanAdmin: RingkasanAdmin = {
      mobil_masuk_hari_ini: Number(rawRingkasan.mobil_masuk_hari_ini ?? 0),
      siap_diambil: Number(rawRingkasan.siap_diambil ?? 0),
      perlu_ditagih: Number(rawRingkasan.perlu_ditagih ?? 0),
      pendapatan_hari_ini: Number(rawRingkasan.pendapatan_hari_ini ?? 0),
      pendapatan: Number(rawRingkasan.pendapatan ?? 0),
      pendapatan_sebelumnya: Number(rawRingkasan.pendapatan_sebelumnya ?? 0),
    };

    return (
      <div className="space-y-6 pb-12">
        {/* Header Dashboard Admin */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">
              Dashboard Meja Depan
            </h1>
            <p className="mt-1 text-xs text-text-muted">
              Halo, <span className="font-medium text-text">{profil.nama}</span> · Ringkasan pendaftaran dan penerimaan mobil ({labelPeriode.toLowerCase()})
            </p>
          </div>
          <PenyaringPeriode periodeAktif={periode} />
        </div>

        <DashboardAdmin
          ringkasan={ringkasanAdmin}
          trenPendapatan={trenPendapatan}
          woPerStatus={woPerStatus}
          topPart={(resTopPart.data ?? []) as TopItemData[]}
          topJasa={(resTopJasa.data ?? []) as TopItemData[]}
        />
      </div>
    );
  }

  // profil.peran === "kepala_mekanik"
  const [resBeban, resSelesai] = await Promise.all([
    supabase.rpc("dashboard_beban_mekanik", {
      p_dari: dari,
      p_sampai: sampai,
    }),
    supabase.rpc("dashboard_wo_selesai_harian", {
      p_dari: dari,
      p_sampai: sampai,
    }),
  ]);

  const ringkasanMekanik: RingkasanKepalaMekanik = {
    menunggu_ditugaskan: Number(rawRingkasan.menunggu_ditugaskan ?? 0),
    sedang_dikerjakan: Number(rawRingkasan.sedang_dikerjakan ?? 0),
    menunggu_qc: Number(rawRingkasan.menunggu_qc ?? 0),
    terlambat: Number(rawRingkasan.terlambat ?? 0),
    selesai_periode: Number(rawRingkasan.selesai_periode ?? 0),
    selesai_sebelumnya: Number(rawRingkasan.selesai_sebelumnya ?? 0),
  };

  const trenSelesai = (resSelesai.data ?? []).map((item) => ({
    tanggal: item.tanggal,
    jumlah: item.jumlah,
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* Header Dashboard Kepala Mekanik */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">
            Dashboard Tim Mekanik
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Halo, <span className="font-medium text-text">{profil.nama}</span> · Pengawasan antrean & kualitas pengerjaan tim ({labelPeriode.toLowerCase()})
          </p>
        </div>
        <PenyaringPeriode periodeAktif={periode} />
      </div>

      <DashboardKepalaMekanik
        ringkasan={ringkasanMekanik}
        trenSelesai={trenSelesai}
        woPerStatus={woPerStatus}
        bebanMekanik={(resBeban.data ?? []) as BebanMekanikItem[]}
      />
    </div>
  );
}
