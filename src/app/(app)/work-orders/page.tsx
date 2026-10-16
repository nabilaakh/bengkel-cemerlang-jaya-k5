import Link from "next/link";
import { Plus, Search, AlertCircle } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { STATUS_WO, type StatusWO } from "@/lib/status-wo";
import { cn } from "@/lib/utils";

const PER_HALAMAN = 20;

const DAFTAR_STATUS = [
  { key: "semua", label: "Semua" },
  { key: "menunggu", label: "Menunggu" },
  { key: "dikerjakan", label: "Dikerjakan" },
  { key: "tertunda", label: "Tertunda" },
  { key: "selesai", label: "Selesai" },
  { key: "siap_diambil", label: "Siap Diambil" },
  { key: "diambil", label: "Diambil" },
  { key: "dibatalkan", label: "Dibatalkan" },
];

export default async function HalamanWorkOrders({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tim?: string; hal?: string }>;
}) {
  const { q = "", status: filterStatus = "semua", tim, hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // Bawaan filter tim untuk kepala mekanik
  const timAktif = tim ?? (profil.peran === "kepala_mekanik" ? profil.id : "semua");

  // Ambil daftar kepala mekanik untuk filter dropdown
  const { data: daftarKepalaMekanik } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // Ambil hitungan per status untuk tab
  let kueriHitung = supabase.from("work_orders").select("status, kepala_mekanik_id");
  if (timAktif !== "semua") {
    kueriHitung = kueriHitung.eq("kepala_mekanik_id", timAktif);
  }
  const { data: semuaStatus } = await kueriHitung;

  const hitunganStatus: Record<string, number> = { semua: semuaStatus?.length ?? 0 };
  for (const item of semuaStatus ?? []) {
    hitunganStatus[item.status] = (hitunganStatus[item.status] || 0) + 1;
  }

  // Bangun query tabel work order
  let kueri = supabase.from("work_orders").select(
    `
      id,
      nomor,
      status,
      odometer,
      estimasi_selesai,
      created_at,
      kepala_mekanik_id,
      vehicles!inner (plat),
      customers!inner (nama),
      profiles!work_orders_kepala_mekanik_id_fkey (nama),
      invoices (total, status_bayar)
    `,
    { count: "exact" },
  );

  // Filter Tim
  if (timAktif !== "semua") {
    kueri = kueri.eq("kepala_mekanik_id", timAktif);
  }

  // Filter Status
  if (filterStatus && filterStatus !== "semua") {
    kueri = kueri.eq("status", filterStatus);
  }

  // Pencarian (Nomor WO, Plat, atau Nama Pelanggan)
  if (cari) {
    kueri = kueri.or(
      `nomor.ilike.%${cari}%,vehicles.plat.ilike.%${cari}%,customers.nama.ilike.%${cari}%`,
    );
  }

  const { data: workOrders, count, error } = await kueri
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  const bolehBuat = profil.peran === "admin" || profil.peran === "owner";
  const hariIniStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Work Order</h1>
          <p className="text-sm text-text-muted">
            Kelola pengerjaan dan alur servis kendaraan bengkel
          </p>
        </div>
        {bolehBuat && (
          <Button asChild className="bg-primary text-white hover:bg-primary-strong">
            <Link href="/work-orders/baru">
              <Plus className="mr-1.5 size-4" />
              + Work Order
            </Link>
          </Button>
        )}
      </div>

      {/* Tab Filter Status */}
      <div className="flex overflow-x-auto border-b border-border pb-1">
        <div className="flex gap-2">
          {DAFTAR_STATUS.map((s) => {
            const aktif = filterStatus === s.key;
            const sp = new URLSearchParams();
            if (q) sp.set("q", q);
            if (timAktif !== "semua") sp.set("tim", timAktif);
            if (s.key !== "semua") sp.set("status", s.key);
            const href = `?${sp.toString()}`;
            const jml = hitunganStatus[s.key] ?? 0;

            return (
              <Link
                key={s.key}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  aktif
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-text-body hover:border-border hover:text-text",
                )}
              >
                {s.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    aktif ? "bg-primary-soft text-primary-strong" : "bg-muted text-text-muted",
                  )}
                >
                  {jml}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bar Pencarian & Filter Tim */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Cari No WO, plat, pelanggan..."
            className="pl-9 bg-card"
          />
          {filterStatus !== "semua" && <input type="hidden" name="status" value={filterStatus} />}
          {timAktif !== "semua" && <input type="hidden" name="tim" value={timAktif} />}
        </form>

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">Tim:</span>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <Link
              href={`?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(filterStatus !== "semua" ? { status: filterStatus } : {}),
                tim: "semua",
              }).toString()}`}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                timAktif === "semua"
                  ? "bg-card text-primary shadow-sm"
                  : "text-text-muted hover:text-text",
              )}
            >
              Semua Tim
            </Link>

            {daftarKepalaMekanik?.map((km) => (
              <Link
                key={km.id}
                href={`?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(filterStatus !== "semua" ? { status: filterStatus } : {}),
                  tim: km.id,
                }).toString()}`}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  timAktif === km.id
                    ? "bg-card text-primary shadow-sm"
                    : "text-text-muted hover:text-text",
                )}
              >
                {km.nama}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel Work Orders */}
      <Card className="overflow-hidden border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-36 font-medium text-text">No WO</TableHead>
              <TableHead className="w-32 font-medium text-text">Plat</TableHead>
              <TableHead className="font-medium text-text">Pelanggan</TableHead>
              <TableHead className="font-medium text-text">Tim</TableHead>
              <TableHead className="font-medium text-text">Estimasi Selesai</TableHead>
              <TableHead className="text-right font-medium text-text">Total</TableHead>
              <TableHead className="w-36 text-center font-medium text-text">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders && workOrders.length > 0 ? (
              workOrders.map((wo) => {
                const totalInvoice = wo.invoices?.total;
                const isTerlambat =
                  wo.estimasi_selesai &&
                  wo.estimasi_selesai < hariIniStr &&
                  ["menunggu", "dikerjakan", "tertunda"].includes(wo.status);

                return (
                  <TableRow key={wo.id} className="border-border hover:bg-muted/30">
                    <TableCell className="font-semibold">
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="text-primary hover:underline"
                      >
                        {wo.nomor}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {wo.vehicles?.plat}
                    </TableCell>
                    <TableCell>{wo.customers?.nama}</TableCell>
                    <TableCell className="text-text-body">
                      {wo.profiles?.nama || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span>
                          {wo.estimasi_selesai ? tanggal(wo.estimasi_selesai) : "-"}
                        </span>
                        {isTerlambat && (
                          <Badge
                            variant="destructive"
                            className="bg-danger text-white text-[10px] px-1.5 py-0 font-semibold"
                          >
                            Terlambat
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {totalInvoice != null ? rupiah(totalInvoice) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <BadgeStatus status={wo.status} />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-text-muted">
                  {cari || filterStatus !== "semua" || timAktif !== "semua"
                    ? "Tidak ada Work Order yang sesuai dengan penyaring."
                    : "Belum ada Work Order."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Navigasi Paginasi */}
      <Paginasi
        halaman={halaman}
        totalBaris={count ?? 0}
        perHalaman={PER_HALAMAN}
        params={{
          ...(q ? { q } : {}),
          ...(filterStatus !== "semua" ? { status: filterStatus } : {}),
          ...(timAktif !== "semua" ? { tim: timAktif } : {}),
        }}
      />
    </div>
  );
}
