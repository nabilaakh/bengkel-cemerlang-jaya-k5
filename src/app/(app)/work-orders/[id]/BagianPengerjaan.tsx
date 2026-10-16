"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wrench,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { unggahFotoWorkOrder } from "@/lib/foto";

interface BagianPengerjaanProps {
  workOrderId: string;
  status: string;
  kepalaMekanikId: string;
  peranSaya: "owner" | "admin" | "kepala_mekanik";
  userId: string;
  items: {
    id: string;
    nama_item: string;
    jenis: string;
    jumlah: number;
    harga_dipakai: number;
  }[];
  fotoPengerjaan: { path: string; signedUrl: string }[];
  fotoKondisiAkhir: { path: string; signedUrl: string }[];
}

export function BagianPengerjaan({
  workOrderId,
  status,
  kepalaMekanikId,
  peranSaya,
  userId,
  items,
  fotoPengerjaan,
  fotoKondisiAkhir,
}: BagianPengerjaanProps) {
  const router = useRouter();
  const supabase = createClient();

  const isKmTimIni = peranSaya === "kepala_mekanik" && kepalaMekanikId === userId;
  const bolehUnggahPengerjaan =
    status === "dikerjakan" && (isKmTimIni || peranSaya === "owner");
  const bolehUnggahAkhir =
    status === "siap_diambil" && (peranSaya === "admin" || peranSaya === "owner");

  const [uploading, setUploading] = useState(false);
  const [fotoAktif, setFotoAktif] = useState<{ url: string; judul: string } | null>(null);

  const filePengerjaanRef = useRef<HTMLInputElement>(null);
  const fileAkhirRef = useRef<HTMLInputElement>(null);

  // Unggah Foto Pengerjaan
  const handleUnggahPengerjaan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      toast.info("Mengompres dan mengunggah foto pengerjaan...");
      await unggahFotoWorkOrder({
        supabase,
        workOrderId,
        jenis: "pengerjaan",
        file,
        userId,
      });
      toast.success("Foto pengerjaan berhasil diunggah");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah foto");
    } finally {
      setUploading(false);
      if (filePengerjaanRef.current) filePengerjaanRef.current.value = "";
    }
  };

  // Unggah Foto Kondisi Akhir
  const handleUnggahAkhir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      toast.info("Mengompres dan mengunggah foto kondisi akhir...");
      await unggahFotoWorkOrder({
        supabase,
        workOrderId,
        jenis: "kondisi_akhir",
        file,
        userId,
      });
      toast.success("Foto kondisi akhir berhasil diunggah");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah foto");
    } finally {
      setUploading(false);
      if (fileAkhirRef.current) fileAkhirRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Bagian C. Pengerjaan</h2>
        <Button variant="outline" size="sm" asChild className="text-xs">
          <Link href={`/work-orders/${workOrderId}/tagihan`}>
            Buka Tab Tagihan
            <ExternalLink className="ml-1 size-3" />
          </Link>
        </Button>
      </div>

      {/* Tabel Item Jasa & Spare Part */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              Item Jasa & Spare Part Terpasang ({items.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/30">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs w-24">Jenis</TableHead>
                  <TableHead className="text-xs text-right w-20">Jumlah</TableHead>
                  <TableHead className="text-xs text-right w-32">Harga</TableHead>
                  <TableHead className="text-xs text-right w-32">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id} className="border-border">
                    <TableCell className="font-medium text-text">{it.nama_item}</TableCell>
                    <TableCell className="text-xs uppercase text-text-muted">
                      {it.jenis}
                    </TableCell>
                    <TableCell className="text-right font-mono">{it.jumlah}</TableCell>
                    <TableCell className="text-right font-mono">
                      {rupiah(it.harga_dipakai)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {rupiah(it.jumlah * it.harga_dipakai)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-6 text-center text-xs text-text-muted">
              Belum ada spare part atau jasa yang dicatat. Kelola rincian item di{" "}
              <Link
                href={`/work-orders/${workOrderId}/tagihan`}
                className="text-primary hover:underline font-medium"
              >
                Tab Tagihan
              </Link>
              .
            </div>
          )}
        </CardContent>
      </Card>

      {/* Foto Dokumentasi Pengerjaan & Kondisi Akhir */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Foto Pengerjaan */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" />
                Foto Pengerjaan Mekanik ({fotoPengerjaan.length})
              </CardTitle>
              {bolehUnggahPengerjaan && (
                <>
                  <input
                    ref={filePengerjaanRef}
                    type="file"
                    accept="image/jpeg,image/webp,image/png"
                    onChange={handleUnggahPengerjaan}
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => filePengerjaanRef.current?.click()}
                    disabled={uploading}
                    className="h-7 text-xs"
                  >
                    {uploading ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1 size-3" />
                    )}
                    + Foto
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {fotoPengerjaan.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fotoPengerjaan.map((f, idx) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() =>
                      setFotoAktif({ url: f.signedUrl, judul: `Foto Pengerjaan #${idx + 1}` })
                    }
                    className="group relative block overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={f.signedUrl}
                      alt={`Pengerjaan ${idx + 1}`}
                      className="h-24 w-24 object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white">
                      #{idx + 1}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-text-muted">
                Belum ada foto proses pengerjaan.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Foto Kondisi Akhir */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" />
                Foto Kondisi Akhir ({fotoKondisiAkhir.length})
              </CardTitle>
              {bolehUnggahAkhir && (
                <>
                  <input
                    ref={fileAkhirRef}
                    type="file"
                    accept="image/jpeg,image/webp,image/png"
                    onChange={handleUnggahAkhir}
                    className="hidden"
                    disabled={uploading || fotoKondisiAkhir.length >= 4}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileAkhirRef.current?.click()}
                    disabled={uploading || fotoKondisiAkhir.length >= 4}
                    className="h-7 text-xs"
                  >
                    {uploading ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1 size-3" />
                    )}
                    + Foto ({fotoKondisiAkhir.length}/4)
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {fotoKondisiAkhir.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fotoKondisiAkhir.map((f, idx) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() =>
                      setFotoAktif({ url: f.signedUrl, judul: `Foto Kondisi Akhir #${idx + 1}` })
                    }
                    className="group relative block overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={f.signedUrl}
                      alt={`Kondisi Akhir ${idx + 1}`}
                      className="h-24 w-24 object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white">
                      #{idx + 1}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-muted">
                {status === "siap_diambil" ? (
                  <div className="flex items-center gap-1.5 text-warning font-medium">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>Unggah minimal 1 foto kondisi akhir sebelum Serahkan Mobil.</span>
                  </div>
                ) : (
                  <span className="italic">Foto diunggah saat status Siap Diambil.</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Preview Foto */}
      <Dialog open={!!fotoAktif} onOpenChange={() => setFotoAktif(null)}>
        <DialogContent className="max-w-3xl p-3">
          <DialogHeader>
            <DialogTitle className="text-sm">{fotoAktif?.judul}</DialogTitle>
          </DialogHeader>
          {fotoAktif && (
            <div className="overflow-hidden rounded-lg max-h-[75vh] flex items-center justify-center bg-black/5">
              <img
                src={fotoAktif.url}
                alt={fotoAktif.judul}
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
