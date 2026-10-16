import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, DollarSign, FileSpreadsheet, Percent, Receipt, TrendingUp, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";

function dapatkanRentangTanggal(
  periode: string,
  dariParam?: string,
  sampaiParam?: string,
): { dari: string; sampai: string; label: string } {
  const sekarang = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  if (periode === "kustom" && dariParam && sampaiParam) {
    return { dari: dariParam, sampai: sampaiParam, label: "Rentang Khusus" };
  }

  if (periode === "bulan_lalu") {
    const awalBulanLalu = new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, 1);
    const akhirBulanLalu = new Date(sekarang.getFullYear(), sekarang.getMonth(), 0);
    return {
      dari: formatYMD(awalBulanLalu),
      sampai: formatYMD(akhirBulanLalu),
      label: "Bulan Lalu",
    };
  }

  if (periode === "30_hari") {
    const d30 = new Date(sekarang.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      dari: formatYMD(d30),
      sampai: formatYMD(sekarang),
      label: "30 Hari Terakhir",
    };
  }

  if (periode === "tahun_ini") {
    const awalTahun = new Date(sekarang.getFullYear(), 0, 1);
    const akhirTahun = new Date(sekarang.getFullYear(), 11, 31);
    return {
      dari: formatYMD(awalTahun),
      sampai: formatYMD(akhirTahun),
      label: "Tahun Ini",
    };
  }

  // Bawaan: bulan_ini (awal bulan ini sampai akhir bulan ini)
  const awalBulan = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1);
  const akhirBulan = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0);
  return {
    dari: dariParam || formatYMD(awalBulan),
    sampai: sampaiParam || formatYMD(akhirBulan),
    label: "Bulan Ini",
  };
}

export default async function HalamanLaporanLaba({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; dari?: string; sampai?: string }>;
}) {
  const profil = await ambilProfilSaya();
  // Hanya untuk Owner (PRD 6.12 & 10.2)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { periode = "bulan_ini", dari: dariParam, sampai: sampaiParam } = await searchParams;
  const { dari, sampai, label } = dapatkanRentangTanggal(periode, dariParam, sampaiParam);

  const supabase = await createClient();

  // Ambil angka laporan laba yang dihitung langsung oleh database function PRD 9.3 (hemat egress)
  const { data: laporan, error } = await supabase.rpc("laporan_laba", {
    p_dari: dari,
    p_sampai: sampai,
  });

  const daftarLaba = laporan ?? [];

  // Hitung angka kartu ringkasan dari hasil RPC periode terpilih
  const totalPendapatan = daftarLaba.reduce((acc, row) => acc + (row.pendapatan ?? 0), 0);
  const totalModal = daftarLaba.reduce((acc, row) => acc + (row.modal ?? 0), 0);
  const totalLaba = totalPendapatan - totalModal;
  const marginKotor = totalPendapatan > 0 ? (totalLaba / totalPendapatan) * 100 : 0;

  const presetList = [
    { id: "bulan_ini", label: "Bulan Ini" },
    { id: "bulan_lalu", label: "Bulan Lalu" },
    { id: "30_hari", label: "30 Hari Terakhir" },
    { id: "tahun_ini", label: "Tahun Ini" },
  ];

  return (
    <div className="space-y-6">
      {/* Judul & Penjelasan */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Laporan Laba
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Laba kotor dan margin per Work Order. Data modal hanya dapat diakses oleh Owner.
          </p>
        </div>
      </div>

      {/* Penyaring Periode */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Periode Cepat */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Periode:
            </span>
            {presetList.map((p) => {
              const aktif = periode === p.id;
              return (
                <Button
                  key={p.id}
                  asChild
                  variant={aktif ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <Link href={`/laporan-laba?periode=${p.id}`}>{p.label}</Link>
                </Button>
              );
            })}
          </div>

          {/* Form Rentang Tanggal Kustom */}
          <form className="flex flex-wrap items-center gap-2 text-xs" method="GET">
            <input type="hidden" name="periode" value="kustom" />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Dari:</span>
              <Input
                type="date"
                name="dari"
                defaultValue={dari}
                className="h-8 w-36 text-xs"
                required
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Sampai:</span>
              <Input
                type="date"
                name="sampai"
                defaultValue={sampai}
                className="h-8 w-36 text-xs"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" className="h-8 text-xs gap-1">
              <Filter className="h-3 w-3" />
              Terapkan
            </Button>
          </form>
        </div>
        <div className="text-xs text-muted-foreground">
          Menampilkan data periode: <strong className="text-text">{tanggal(dari)}</strong> s.d.{" "}
          <strong className="text-text">{tanggal(sampai)}</strong> ({label})
        </div>
      </Card>

      {/* 4 Kartu KPI Ringkasan (PRD 6.12) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Pendapatan */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Total Pendapatan</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold tabular-nums text-text">{rupiah(totalPendapatan)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari <span className="font-semibold text-text">{daftarLaba.length}</span> invoice WO
            </p>
          </CardContent>
        </Card>

        {/* Modal Spare Part */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Modal Spare Part</span>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold tabular-nums text-text">{rupiah(totalModal)}</div>
            <p className="text-xs text-muted-foreground mt-1">Biaya modal part terpakai</p>
          </CardContent>
        </Card>

        {/* Laba Kotor */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Laba Kotor</span>
              <TrendingUp className={`h-4 w-4 ${totalLaba < 0 ? "text-danger" : "text-success"}`} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              className={`text-2xl font-bold tabular-nums ${totalLaba < 0 ? "text-danger" : "text-success"}`}
            >
              {rupiah(totalLaba)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendapatan dikurangi modal part</p>
          </CardContent>
        </Card>

        {/* Margin % */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Margin Laba Kotor</span>
              <Percent className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              className={`text-2xl font-bold tabular-nums ${marginKotor < 0 ? "text-danger" : "text-text"}`}
            >
              {marginKotor.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rasio laba kotor terhadap pendapatan</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Detail per Work Order (PRD 6.12) */}
      <Card className="py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">No. WO</TableHead>
              <TableHead>No. Invoice</TableHead>
              <TableHead>Tgl. Invoice</TableHead>
              <TableHead>Plat Kendaraan</TableHead>
              <TableHead className="text-right">Pendapatan</TableHead>
              <TableHead className="text-right">Modal Part</TableHead>
              <TableHead className="text-right">Laba Kotor</TableHead>
              <TableHead className="pr-4 text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-danger">
                  Gagal memuat laporan laba: {error.message}. Silakan muat ulang halaman.
                </TableCell>
              </TableRow>
            )}
            {!error && daftarLaba.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <p className="font-medium text-text">Belum ada invoice di periode ini.</p>
                  <p className="text-xs mt-1">
                    Pilih periode yang lebih luas atau rentang tanggal lain pada penyaring di atas.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {daftarLaba.map((item) => {
              const labaMinus = (item.laba ?? 0) < 0;
              return (
                <TableRow key={item.work_order_id} className={labaMinus ? "bg-rose-50/40 dark:bg-rose-950/20" : undefined}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={`/work-orders/${item.work_order_id}`}
                      className="text-primary hover:underline font-mono text-xs"
                    >
                      {item.nomor_wo}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.nomor_invoice}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {tanggal(item.tanggal)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs uppercase font-medium bg-muted/40">
                      {item.plat}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {rupiah(item.pendapatan ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {rupiah(item.modal ?? 0)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-sm font-semibold ${labaMinus ? "text-danger" : "text-success"}`}
                  >
                    {rupiah(item.laba ?? 0)}
                  </TableCell>
                  <TableCell
                    className={`pr-4 text-right tabular-nums text-sm font-medium ${labaMinus ? "text-danger font-semibold" : "text-text"}`}
                  >
                    {(item.margin_persen ?? 0).toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
