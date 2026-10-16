import { redirect } from "next/navigation";
import { Filter, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Paginasi } from "@/components/Paginasi";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { DialogDetailAudit, type LogAuditItem } from "./DialogDetailAudit";

const PER_HALAMAN = 20;

const DAFTAR_TABEL = [
  { value: "", label: "Semua Tabel" },
  { value: "work_orders", label: "Work Orders" },
  { value: "billing_items", label: "Billing Items" },
  { value: "billing_item_costs", label: "Billing Item Costs" },
  { value: "inventory_items", label: "Inventory Items" },
  { value: "inventory_costs", label: "Inventory Costs" },
  { value: "invoices", label: "Invoices" },
  { value: "payments", label: "Payments" },
  { value: "stock_movements", label: "Stock Movements" },
  { value: "profiles", label: "Profiles / Pengguna" },
];

const DAFTAR_AKSI = [
  { value: "", label: "Semua Aksi" },
  { value: "INSERT", label: "INSERT (Tambah)" },
  { value: "UPDATE", label: "UPDATE (Ubah)" },
  { value: "DELETE", label: "DELETE (Hapus)" },
];

export default async function HalamanAuditLog({
  searchParams,
}: {
  searchParams: Promise<{ hal?: string; tabel?: string; pelaku?: string; aksi?: string }>;
}) {
  const profil = await ambilProfilSaya();
  // Hanya untuk Owner (PRD 6.13 & 10.2)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const { hal, tabel = "", pelaku = "", aksi = "" } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);

  const supabase = await createClient();

  // Ambil daftar pengguna untuk dropdown penyaring pelaku
  const { data: penggunaList } = await supabase
    .from("profiles")
    .select("id, nama, role")
    .order("nama");

  const profilMap = new Map<string, { nama: string; role: string }>();
  (penggunaList ?? []).forEach((p) => profilMap.set(p.id, { nama: p.nama, role: p.role }));

  // Query audit_logs dengan penyaring
  let kueri = supabase
    .from("audit_logs")
    .select("id, waktu, pelaku_id, pelaku_peran, aksi, tabel, data_id, sebelum, sesudah, alasan", {
      count: "exact",
    });

  if (tabel) {
    kueri = kueri.eq("tabel", tabel);
  }
  if (pelaku) {
    kueri = kueri.eq("pelaku_id", pelaku);
  }
  if (aksi) {
    kueri = kueri.eq("aksi", aksi);
  }

  const { data: logs, count, error } = await kueri
    .order("waktu", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  const totalBaris = count ?? 0;

  const items: LogAuditItem[] = (logs ?? []).map((l) => {
    const prof = l.pelaku_id ? profilMap.get(l.pelaku_id) : undefined;
    return {
      id: l.id,
      waktu: l.waktu,
      pelaku_id: l.pelaku_id,
      pelaku_peran: l.pelaku_peran ?? prof?.role ?? null,
      nama_pelaku: prof?.nama ?? (l.pelaku_id ? "Pengguna (" + l.pelaku_id.slice(0, 6) + "...)" : "Sistem"),
      aksi: l.aksi,
      tabel: l.tabel,
      data_id: l.data_id,
      sebelum: l.sebelum,
      sesudah: l.sesudah,
      alasan: l.alasan,
    };
  });

  const adaFilterAktif = Boolean(tabel || pelaku || aksi);

  const getWarnaAksi = (a: string) => {
    switch (a.toUpperCase()) {
      case "INSERT":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300";
      case "UPDATE":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      case "DELETE":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const formatWaktuSingkat = (iso: string) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Riwayat perubahan data penting bengkel. Data audit log bersifat permanen dan tidak dapat diubah atau dihapus.
          </p>
        </div>
      </div>

      {/* Bar Penyaring */}
      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" method="GET">
          {/* Filter Tabel */}
          <div className="space-y-1.5 w-full sm:w-auto min-w-44">
            <label htmlFor="tabel" className="text-xs font-medium text-text">
              Penyaring Tabel
            </label>
            <select
              id="tabel"
              name="tabel"
              defaultValue={tabel}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {DAFTAR_TABEL.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Pelaku */}
          <div className="space-y-1.5 w-full sm:w-auto min-w-44">
            <label htmlFor="pelaku" className="text-xs font-medium text-text">
              Penyaring Pelaku
            </label>
            <select
              id="pelaku"
              name="pelaku"
              defaultValue={pelaku}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Semua Pelaku</option>
              {penggunaList?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Aksi */}
          <div className="space-y-1.5 w-full sm:w-auto min-w-36">
            <label htmlFor="aksi" className="text-xs font-medium text-text">
              Penyaring Aksi
            </label>
            <select
              id="aksi"
              name="aksi"
              defaultValue={aksi}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {DAFTAR_AKSI.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <Button type="submit" size="sm" className="h-9 gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Saring
            </Button>
            {adaFilterAktif && (
              <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                <Link href="/audit-log">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Tabel Data Audit Log */}
      <Card className="py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4 w-44">Waktu (WIB)</TableHead>
              <TableHead className="w-48">Pelaku & Peran</TableHead>
              <TableHead className="w-24">Aksi</TableHead>
              <TableHead>Tabel & Data</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead className="pr-4 text-right w-36">Nilai Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-danger">
                  Gagal memuat catatan audit: {error.message}. Silakan muat ulang halaman.
                </TableCell>
              </TableRow>
            )}
            {!error && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {adaFilterAktif ? (
                    <div>
                      <p className="font-medium text-text">Tidak ada aktivitas audit yang cocok.</p>
                      <p className="text-xs mt-1">Coba ubah atau reset penyaring di atas.</p>
                    </div>
                  ) : (
                    "Belum ada aktivitas yang tercatat di audit log."
                  )}
                </TableCell>
              </TableRow>
            )}
            {items.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="pl-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {formatWaktuSingkat(log.waktu)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm text-text leading-tight">{log.nama_pelaku}</span>
                    {log.pelaku_peran && (
                      <span className="text-[11px] text-muted-foreground uppercase font-mono">
                        {log.pelaku_peran}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`font-semibold text-[11px] ${getWarnaAksi(log.aksi)}`}>
                    {log.aksi}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-text">
                      {log.tabel}
                    </code>
                    {log.data_id && (
                      <span className="text-xs text-muted-foreground font-mono">
                        #{log.data_id}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {log.alasan ? (
                    <span className="text-text font-normal italic" title={log.alasan}>
                      &ldquo;{log.alasan}&rdquo;
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">-</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <DialogDetailAudit log={log} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Paginasi 20 baris per halaman */}
      <Paginasi
        halaman={halaman}
        totalBaris={totalBaris}
        perHalaman={PER_HALAMAN}
        params={{ tabel, pelaku, aksi }}
      />
    </div>
  );
}
