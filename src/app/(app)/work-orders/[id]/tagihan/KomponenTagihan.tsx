"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  FileText,
  Trash2,
  Pencil,
  Info,
  AlertCircle,
  Printer,
  ChevronLeft,
  Loader2,
  TrendingUp,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BadgeStatus } from "@/components/BadgeStatus";
import { TabWorkOrder } from "@/components/TabWorkOrder";
import { rupiah, tanggal } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { DialogTambahItem } from "./DialogTambahItem";
import { DialogSesuaikanHarga } from "./DialogSesuaikanHarga";
import { DialogAturDiskon } from "./DialogAturDiskon";
import { DialogCatatPembayaran } from "./DialogCatatPembayaran";

export interface ItemTagihanTampil {
  id: string;
  item_id: string;
  nama_item: string;
  jenis: string;
  jumlah: number;
  harga_master: number;
  harga_dipakai: number;
  alasan_penyesuaian: string | null;
  disesuaikan_at: string | null;
  disesuaikan_oleh_nama: string | null;
  harga_modal?: number;
}

export interface PembayaranTampil {
  id: string;
  metode: string;
  jumlah: number;
  created_at: string;
  dicatat_oleh_nama: string | null;
}

export interface InvoiceTampil {
  id: string;
  nomor: string;
  subtotal: number;
  diskon: number;
  total: number;
  terbayar: number;
  status_bayar: "belum_bayar" | "sebagian" | "lunas";
  diterbitkan_at: string;
  payments: PembayaranTampil[];
}

interface KomponenTagihanProps {
  workOrder: {
    id: string;
    nomor: string;
    status: string;
    odometer: number;
    keluhan: string;
    estimasi_selesai: string | null;
    diskon: number;
    alasan_diskon: string | null;
    kepala_mekanik_id: string;
    kepala_mekanik_nama: string;
    customer_nama: string;
    customer_telepon: string;
    plat: string;
    merek_model: string;
  };
  items: ItemTagihanTampil[];
  invoice: InvoiceTampil | null;
  daftarInventory: {
    id: string;
    kode: string;
    jenis: string;
    nama: string;
    harga_jual: number;
    stok: number;
  }[];
  peranSaya: "owner" | "admin" | "kepala_mekanik";
  userId: string;
}

export function KomponenTagihan({
  workOrder,
  items,
  invoice,
  daftarInventory,
  peranSaya,
  userId,
}: KomponenTagihanProps) {
  const router = useRouter();
  const supabase = createClient();

  const isKmTimIni =
    peranSaya === "kepala_mekanik" && workOrder.kepala_mekanik_id === userId;
  const isOwner = peranSaya === "owner";
  const isAdmin = peranSaya === "admin";
  const bolehKelolaPengerjaan =
    workOrder.status === "dikerjakan" && !invoice && (isKmTimIni || isOwner);
  const bolehKelolaHarga = !invoice && (isAdmin || isOwner);
  const bolehTerbitkanInvoice =
    workOrder.status === "siap_diambil" && !invoice && (isAdmin || isOwner);
  const bolehCatatBayar =
    invoice && invoice.status_bayar !== "lunas" && (isAdmin || isOwner);

  // Status terlambat
  const terlambat =
    workOrder.estimasi_selesai &&
    new Date(workOrder.estimasi_selesai) < new Date(new Date().toDateString()) &&
    workOrder.status !== "selesai" &&
    workOrder.status !== "siap_diambil" &&
    workOrder.status !== "diambil" &&
    workOrder.status !== "dibatalkan";

  // Perhitungan Subtotal dan Ringkasan
  const subtotal = items.reduce(
    (acc, it) => acc + it.jumlah * it.harga_dipakai,
    0
  );
  const diskon = invoice ? invoice.diskon : workOrder.diskon || 0;
  const total = invoice
    ? invoice.total
    : Math.max(0, subtotal - diskon);
  const terbayar = invoice ? invoice.terbayar : 0;
  const sisa = Math.max(0, total - terbayar);

  // Perhitungan Modal dan Laba (hanya untuk Owner)
  const totalModal = isOwner
    ? items.reduce(
        (acc, it) => acc + (it.harga_modal || 0) * it.jumlah,
        0
      )
    : 0;
  const labaKotor = isOwner ? total - totalModal : 0;
  const marginPersen =
    isOwner && total > 0 ? (labaKotor / total) * 100 : 0;

  // State Dialog
  const [itemUntukEditHarga, setItemUntukEditHarga] = useState<ItemTagihanTampil | null>(null);
  const [openEditHarga, setOpenEditHarga] = useState(false);

  const [itemUntukDihapus, setItemUntukDihapus] = useState<ItemTagihanTampil | null>(null);
  const [openHapusItem, setOpenHapusItem] = useState(false);
  const [loadingHapus, setLoadingHapus] = useState(false);

  const [openTerbitkanInvoice, setOpenTerbitkanInvoice] = useState(false);
  const [loadingTerbitkan, setLoadingTerbitkan] = useState(false);

  // Eksekusi Hapus Item
  const handleKonfirmasiHapus = async () => {
    if (!itemUntukDihapus) return;
    setLoadingHapus(true);
    try {
      const { error } = await supabase.rpc("hapus_item_tagihan", {
        p_billing_item: itemUntukDihapus.id,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(
        `${itemUntukDihapus.nama_item} berhasil dihapus dari tagihan`
      );
      setOpenHapusItem(false);
      setItemUntukDihapus(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus baris tagihan"
      );
    } finally {
      setLoadingHapus(false);
    }
  };

  // Eksekusi Terbitkan Invoice
  const handleKonfirmasiTerbitkanInvoice = async () => {
    if (items.length === 0) {
      toast.error("Tagihan tidak boleh kosong saat menerbitkan invoice");
      return;
    }

    setLoadingTerbitkan(true);
    try {
      const { error } = await supabase.rpc("terbitkan_invoice", {
        p_wo: workOrder.id,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Invoice berhasil diterbitkan!");
      setOpenTerbitkanInvoice(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menerbitkan invoice"
      );
    } finally {
      setLoadingTerbitkan(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Link
              href={`/work-orders/${workOrder.id}`}
              className="inline-flex items-center hover:text-text transition-colors"
            >
              <ChevronLeft className="mr-0.5 size-3.5" />
              Kembali ke Rincian WO
            </Link>
            <span>/</span>
            <span>Tagihan</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-text">
              {workOrder.nomor}
            </h1>
            <BadgeStatus status={workOrder.status} />
            {terlambat && (
              <Badge className="bg-danger text-white border-transparent text-xs">
                Terlambat
              </Badge>
            )}
            {invoice && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  invoice.status_bayar === "lunas"
                    ? "border-success text-success bg-success/10 font-medium"
                    : invoice.status_bayar === "sebagian"
                    ? "border-warning text-warning bg-warning/10 font-medium"
                    : "border-text-muted text-text-muted"
                }`}
              >
                INV: {invoice.nomor} (
                {invoice.status_bayar === "lunas"
                  ? "Lunas"
                  : invoice.status_bayar === "sebagian"
                  ? "Sebagian"
                  : "Belum Bayar"}
                )
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {workOrder.plat} · {workOrder.merek_model} · Pelanggan:{" "}
            <span className="font-medium text-text">{workOrder.customer_nama}</span>
          </p>
        </div>

        {/* Tombol Aksi Utama */}
        <div className="flex flex-wrap items-center gap-2">
          {bolehKelolaPengerjaan && (
            <DialogTambahItem
              workOrderId={workOrder.id}
              daftarItem={daftarInventory}
            />
          )}

          {bolehKelolaHarga && (
            <DialogAturDiskon
              workOrderId={workOrder.id}
              diskonSaatIni={workOrder.diskon || 0}
              alasanSaatIni={workOrder.alasan_diskon}
              subtotal={subtotal}
            />
          )}

          {bolehTerbitkanInvoice && (
            <Button
              size="sm"
              onClick={() => setOpenTerbitkanInvoice(true)}
              className="bg-primary text-white hover:bg-primary/90 h-9 text-xs"
            >
              <Receipt className="mr-1.5 size-3.5" />
              Terbitkan Invoice
            </Button>
          )}

          {invoice && (
            <>
              {bolehCatatBayar && (
                <DialogCatatPembayaran
                  invoiceId={invoice.id}
                  nomorInvoice={invoice.nomor}
                  total={invoice.total}
                  terbayar={invoice.terbayar}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-9 text-xs border-primary text-primary hover:bg-primary/10"
              >
                <Link href={`/work-orders/${workOrder.id}/invoice`}>
                  <Printer className="mr-1.5 size-3.5" />
                  Lihat / Cetak Invoice
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Navigasi Tab WO */}
      <TabWorkOrder id={workOrder.id} />

      {/* Banner Informasi Status Kunci */}
      {invoice ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-text-muted">
          <Info className="size-4 text-primary shrink-0" />
          <span>
            Invoice nomor <strong>{invoice.nomor}</strong> telah terbit pada{" "}
            {tanggal(invoice.diterbitkan_at)}. Rincian baris tagihan dan diskon
            sudah dikunci.
          </span>
        </div>
      ) : workOrder.status !== "dikerjakan" && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-text">
          <AlertCircle className="size-4 text-warning shrink-0" />
          <span>
            Status Work Order saat ini adalah <strong>{workOrder.status}</strong>.
            Penambahan atau penghapusan item hanya dapat dilakukan saat status{" "}
            <strong>dikerjakan</strong>.
          </span>
        </div>
      )}

      {/* Tabel Rincian Item Tagihan */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              Rincian Item Tagihan ({items.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/30">
                <TableHead className="w-12 text-center text-xs">No</TableHead>
                <TableHead className="text-xs">Item</TableHead>
                <TableHead className="w-24 text-xs">Jenis</TableHead>
                <TableHead className="w-20 text-right text-xs">Jumlah</TableHead>
                <TableHead className="w-32 text-right text-xs">Harga Master</TableHead>
                <TableHead className="w-36 text-right text-xs">Harga Dipakai</TableHead>
                <TableHead className="w-32 text-right text-xs">Subtotal</TableHead>
                {isOwner && (
                  <>
                    <TableHead className="w-32 text-right text-xs text-primary-strong">
                      Harga Modal
                    </TableHead>
                    <TableHead className="w-32 text-right text-xs text-success">
                      Laba Baris
                    </TableHead>
                  </>
                )}
                {(!invoice && (bolehKelolaHarga || bolehKelolaPengerjaan)) && (
                  <TableHead className="w-24 text-center text-xs">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((it, idx) => {
                  const disesuaikan = it.harga_dipakai !== it.harga_master;
                  const itemSubtotal = it.jumlah * it.harga_dipakai;
                  const itemModal = (it.harga_modal || 0) * it.jumlah;
                  const itemLaba = itemSubtotal - itemModal;

                  return (
                    <TableRow key={it.id} className="border-border">
                      <TableCell className="text-center font-mono text-xs text-text-muted">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium text-text">
                        <div className="space-y-0.5">
                          <div>{it.nama_item}</div>
                          {disesuaikan && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-500/20"
                                >
                                  <Info className="size-2.5" />
                                  Harga Disesuaikan
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3 text-xs space-y-1.5">
                                <div className="font-semibold text-text">
                                  Informasi Penyesuaian Harga
                                </div>
                                <div className="text-text-muted">
                                  <strong>Alasan:</strong>{" "}
                                  {it.alasan_penyesuaian || "Tidak ada catatan"}
                                </div>
                                {it.disesuaikan_oleh_nama && (
                                  <div className="text-[11px] text-text-muted">
                                    Oleh: {it.disesuaikan_oleh_nama}
                                  </div>
                                )}
                                {it.disesuaikan_at && (
                                  <div className="text-[11px] text-text-muted">
                                    Waktu: {tanggal(it.disesuaikan_at)}
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs uppercase text-text-muted">
                        <Badge variant="outline" className="text-[10px] uppercase h-5 px-1.5">
                          {it.jenis}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {it.jumlah}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-text-muted">
                        {rupiah(it.harga_master)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        <span className={disesuaikan ? "text-amber-700 font-semibold" : "text-text"}>
                          {rupiah(it.harga_dipakai)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-text">
                        {rupiah(itemSubtotal)}
                      </TableCell>

                      {/* Kolom Khusus Owner */}
                      {isOwner && (
                        <>
                          <TableCell className="text-right font-mono text-xs text-text-muted">
                            {rupiah(it.harga_modal || 0)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-xs font-medium ${
                              itemLaba < 0 ? "text-danger" : "text-success"
                            }`}
                          >
                            {rupiah(itemLaba)}
                          </TableCell>
                        </>
                      )}

                      {/* Kolom Aksi */}
                      {(!invoice && (bolehKelolaHarga || bolehKelolaPengerjaan)) && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {bolehKelolaHarga && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setItemUntukEditHarga(it);
                                  setOpenEditHarga(true);
                                }}
                                className="h-7 w-7 p-0 text-text-muted hover:text-primary"
                                title="Sesuaikan Harga"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {bolehKelolaPengerjaan && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setItemUntukDihapus(it);
                                  setOpenHapusItem(true);
                                }}
                                className="h-7 w-7 p-0 text-text-muted hover:text-danger"
                                title="Hapus Item"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 10 : 8}
                    className="py-8 text-center text-xs text-text-muted"
                  >
                    Belum ada spare part atau jasa dalam tagihan ini.
                    {bolehKelolaPengerjaan && (
                      <div className="mt-2">
                        Gunakan tombol <strong>+ Tambah Item</strong> di atas
                        untuk mencatat pengerjaan.
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ringkasan Finansial Tagihan */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Ringkasan Total & Status Pembayaran */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-text flex items-center justify-between">
              <span>Ringkasan Tagihan</span>
              {invoice ? (
                <Badge
                  variant="outline"
                  className={
                    invoice.status_bayar === "lunas"
                      ? "border-success text-success bg-success/10"
                      : invoice.status_bayar === "sebagian"
                      ? "border-warning text-warning bg-warning/10"
                      : "border-text-muted text-text-muted"
                  }
                >
                  {invoice.status_bayar === "lunas"
                    ? "Lunas"
                    : invoice.status_bayar === "sebagian"
                    ? "Sebagian"
                    : "Belum Bayar"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-text-muted">
                  Belum Diterbitkan
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-text-muted">Subtotal:</span>
              <span className="font-mono font-medium text-text">{rupiah(subtotal)}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-text-muted">
                Diskon {workOrder.alasan_diskon ? `(${workOrder.alasan_diskon})` : ""}:
              </span>
              <span className="font-mono font-medium text-danger">
                {diskon > 0 ? `-${rupiah(diskon)}` : "Rp0"}
              </span>
            </div>

            <div className="flex justify-between border-t border-border pt-2 py-1 font-semibold text-sm">
              <span className="text-text">Total Tagihan:</span>
              <span className="font-mono text-primary">{rupiah(total)}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-text-muted">Sudah Dibayar:</span>
              <span className="font-mono font-medium text-success">{rupiah(terbayar)}</span>
            </div>

            <div className="flex justify-between border-t border-border pt-2 py-1 font-bold text-sm">
              <span className="text-text">Sisa Tagihan:</span>
              <span className={`font-mono ${sisa > 0 ? "text-danger" : "text-text"}`}>
                {rupiah(sisa)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Ringkasan Modal dan Laba (Hanya Owner) atau Riwayat Pembayaran */}
        {isOwner ? (
          <Card className="border-border bg-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
                <TrendingUp className="size-4 text-success" />
                Laba Kotor Work Order (Owner Only)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Pendapatan Total:</span>
                <span className="font-mono font-medium text-text">{rupiah(total)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Total Modal Spare Part:</span>
                <span className="font-mono font-medium text-text-muted">
                  {rupiah(totalModal)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 py-1 font-semibold text-sm">
                <span className="text-text">Laba Kotor:</span>
                <span
                  className={`font-mono ${
                    labaKotor < 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {rupiah(labaKotor)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted flex items-center gap-1">
                  <Percent className="size-3" />
                  Margin Keuntungan:
                </span>
                <span className="font-mono font-medium text-text">
                  {marginPersen.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Ketentuan Invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-text-muted space-y-2">
              <p>
                • Invoice resmi dapat diterbitkan oleh Admin atau Owner saat Work
                Order berstatus <strong>Siap Diambil</strong>.
              </p>
              <p>
                • Setelah diterbitkan, nomor invoice otomatis terbuat dan baris
                tagihan dikunci dari perubahan.
              </p>
              <p>
                • Mobil dapat diserahkan ke pelanggan setelah pembayaran lunas
                dan foto kondisi akhir diunggah.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Riwayat Pembayaran (Jika Ada) */}
      {invoice && invoice.payments && invoice.payments.length > 0 && (
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
              <Receipt className="size-4 text-success" />
              Riwayat Pembayaran ({invoice.payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/30">
                  <TableHead className="w-12 text-center text-xs">No</TableHead>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Metode</TableHead>
                  <TableHead className="text-right text-xs">Jumlah</TableHead>
                  <TableHead className="text-xs">Dicatat Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((p, idx) => (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="text-center font-mono text-xs text-text-muted">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="text-xs">{tanggal(p.created_at)}</TableCell>
                    <TableCell className="text-xs uppercase font-medium">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {p.metode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-success">
                      {rupiah(p.jumlah)}
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">
                      {p.dicatat_oleh_nama || "Petugas"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog Sesuaikan Harga */}
      <DialogSesuaikanHarga
        item={itemUntukEditHarga}
        open={openEditHarga}
        onOpenChange={setOpenEditHarga}
      />

      {/* Dialog Konfirmasi Hapus Item Tagihan */}
      <AlertDialog open={openHapusItem} onOpenChange={setOpenHapusItem}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-text">
              Hapus Item dari Tagihan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-text-muted">
              Apakah Anda yakin ingin menghapus{" "}
              <strong>{itemUntukDihapus?.nama_item}</strong>? Bila item ini adalah
              spare part, stok akan otomatis dikembalikan ke inventaris bengkel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingHapus} className="text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKonfirmasiHapus}
              disabled={loadingHapus}
              className="bg-danger text-white hover:bg-danger/90 text-xs"
            >
              {loadingHapus && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Hapus Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Konfirmasi Terbitkan Invoice */}
      <AlertDialog
        open={openTerbitkanInvoice}
        onOpenChange={setOpenTerbitkanInvoice}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-text">
              Terbitkan Invoice Resmi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-text-muted space-y-2">
              <p>
                Nomor invoice resmi akan dibuat secara otomatis dan seluruh baris
                tagihan akan <strong>dikunci</strong> secara permanen.
              </p>
              <div className="bg-muted/40 p-2.5 rounded border border-border text-xs">
                <div>Subtotal: {rupiah(subtotal)}</div>
                {diskon > 0 && <div className="text-danger">Diskon: -{rupiah(diskon)}</div>}
                <div className="font-semibold text-primary pt-1">
                  Total Tagihan: {rupiah(total)}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingTerbitkan} className="text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKonfirmasiTerbitkanInvoice}
              disabled={loadingTerbitkan}
              className="bg-primary text-white hover:bg-primary/90 text-xs"
            >
              {loadingTerbitkan && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Ya, Terbitkan Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
