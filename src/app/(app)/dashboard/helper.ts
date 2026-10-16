import type { PeriodeDashboard } from "./components/PenyaringPeriode";

export function hitungRentangTanggal(periode: PeriodeDashboard = "bulan_ini"): {
  dari: string;
  sampai: string;
  label: string;
} {
  // Format tanggal Indonesia / Jakarta (YYYY-MM-DD)
  const sekarang = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const tglHariIni = formatYMD(sekarang);

  if (periode === "hari_ini") {
    return {
      dari: tglHariIni,
      sampai: tglHariIni,
      label: "Hari ini",
    };
  }

  if (periode === "7_hari") {
    const d7 = new Date(sekarang);
    d7.setDate(sekarang.getDate() - 6);
    return {
      dari: formatYMD(d7),
      sampai: tglHariIni,
      label: "7 hari terakhir",
    };
  }

  if (periode === "30_hari") {
    const d30 = new Date(sekarang);
    d30.setDate(sekarang.getDate() - 29);
    return {
      dari: formatYMD(d30),
      sampai: tglHariIni,
      label: "30 hari terakhir",
    };
  }

  // Bawaan: bulan_ini (tanggal 1 awal bulan s/d akhir bulan berjalan)
  const awalBulan = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1);
  const akhirBulan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0);

  return {
    dari: formatYMD(awalBulan),
    sampai: formatYMD(akhirBulan),
    label: "Bulan ini",
  };
}
