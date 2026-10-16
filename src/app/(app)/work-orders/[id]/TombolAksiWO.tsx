"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Send,
  Ban,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface TombolAksiWOProps {
  workOrderId: string;
  status: string;
  kepalaMekanikId: string;
  peranSaya: "owner" | "admin" | "kepala_mekanik";
  userId: string;
  mekanikCount: number;
  adaEstimasi: boolean;
  itemCount: number;
  invoiceStatus?: string | null;
  fotoAkhirCount: number;
}

export function TombolAksiWO({
  workOrderId,
  status,
  kepalaMekanikId,
  peranSaya,
  userId,
  mekanikCount,
  adaEstimasi,
  itemCount,
  invoiceStatus,
  fotoAkhirCount,
}: TombolAksiWOProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [dialogBuka, setDialogBuka] = useState(false);
  const [dialogAksi, setDialogAksi] = useState<{
    statusTujuan: string;
    judul: string;
    deskripsi: string;
    labelCatatan: string;
    placeholder: string;
    wajibCatatan: boolean;
  } | null>(null);

  const [catatan, setCatatan] = useState("");

  const isKmTimIni = peranSaya === "kepala_mekanik" && kepalaMekanikId === userId;
  const isKmOrOwner = isKmTimIni || peranSaya === "owner";
  const isAdminOrOwner = peranSaya === "admin" || peranSaya === "owner";

  // Eksekusi fungsi ubah_status_wo
  const handleUbahStatus = async (statusTujuan: string, isiCatatan?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("ubah_status_wo", {
        p_wo: workOrderId,
        p_status: statusTujuan,
        p_catatan: isiCatatan || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(`Status Work Order berhasil diubah ke '${statusTujuan}'`);
      setDialogBuka(false);
      setCatatan("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah status Work Order");
    } finally {
      setLoading(false);
    }
  };

  const bukaDialog = (aksi: {
    statusTujuan: string;
    judul: string;
    deskripsi: string;
    labelCatatan: string;
    placeholder: string;
    wajibCatatan: boolean;
  }) => {
    setDialogAksi(aksi);
    setCatatan("");
    setDialogBuka(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. Status: MENUNGGU */}
        {status === "menunggu" && (
          <>
            {isKmOrOwner && (
              <Button
                disabled={loading || mekanikCount < 1 || !adaEstimasi}
                onClick={() => handleUbahStatus("dikerjakan")}
                className="bg-primary text-white hover:bg-primary-strong"
                title={
                  mekanikCount < 1 || !adaEstimasi
                    ? "Tugaskan mekanik dan isi estimasi selesai terlebih dahulu di Bagian B"
                    : "Mulai kerjakan WO ini"
                }
              >
                {loading ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Play className="mr-1.5 size-4" />
                )}
                Mulai Kerjakan
              </Button>
            )}

            {isAdminOrOwner && (
              <Button
                variant="outline"
                disabled={loading}
                onClick={() =>
                  bukaDialog({
                    statusTujuan: "dibatalkan",
                    judul: "Batalkan Work Order",
                    deskripsi:
                      "Work Order yang dibatalkan tidak dapat dilanjutkan lagi.",
                    labelCatatan: "Alasan Pembatalan *",
                    placeholder: "Contoh: Pelanggan membatalkan servis karena...",
                    wajibCatatan: true,
                  })
                }
                className="text-danger hover:bg-danger/10 hover:text-danger"
              >
                <Ban className="mr-1.5 size-4" />
                Batalkan WO
              </Button>
            )}
          </>
        )}

        {/* 2. Status: DIKERJAKAN */}
        {status === "dikerjakan" && (
          <>
            {isKmOrOwner && (
              <>
                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={() =>
                    bukaDialog({
                      statusTujuan: "tertunda",
                      judul: "Tunda Pengerjaan",
                      deskripsi: "Masukkan alasan penundaan pengerjaan mobil ini.",
                      labelCatatan: "Catatan Penundaan *",
                      placeholder: "Contoh: Menunggu kiriman spare part kampas rem...",
                      wajibCatatan: true,
                    })
                  }
                  className="border-warning text-warning hover:bg-warning/10"
                >
                  <Pause className="mr-1.5 size-4" />
                  Tunda
                </Button>

                <Button
                  disabled={loading || itemCount < 1}
                  onClick={() => handleUbahStatus("selesai")}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                  title={
                    itemCount < 1
                      ? "Catat minimal 1 jasa atau spare part sebelum menyelesaikan pengerjaan"
                      : "Selesaikan pengerjaan mekanik"
                  }
                >
                  {loading ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-1.5 size-4" />
                  )}
                  Selesai Dikerjakan
                </Button>
              </>
            )}

            {isAdminOrOwner && (
              <Button
                variant="outline"
                disabled={loading}
                onClick={() =>
                  bukaDialog({
                    statusTujuan: "dibatalkan",
                    judul: "Batalkan Work Order",
                    deskripsi:
                      "Spare part yang sudah tercatat pada WO ini akan otomatis dikembalikan ke stok inventory.",
                    labelCatatan: "Alasan Pembatalan *",
                    placeholder: "Alasan pembatalan...",
                    wajibCatatan: true,
                  })
                }
                className="text-danger hover:bg-danger/10 hover:text-danger"
              >
                <Ban className="mr-1.5 size-4" />
                Batalkan WO
              </Button>
            )}
          </>
        )}

        {/* 3. Status: TERTUNDA */}
        {status === "tertunda" && (
          <>
            {isKmOrOwner && (
              <Button
                disabled={loading}
                onClick={() => handleUbahStatus("dikerjakan")}
                className="bg-primary text-white hover:bg-primary-strong"
              >
                {loading ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Play className="mr-1.5 size-4" />
                )}
                Lanjutkan Pengerjaan
              </Button>
            )}

            {isAdminOrOwner && (
              <Button
                variant="outline"
                disabled={loading}
                onClick={() =>
                  bukaDialog({
                    statusTujuan: "dibatalkan",
                    judul: "Batalkan Work Order",
                    deskripsi:
                      "Spare part yang sudah tercatat akan otomatis dikembalikan ke stok.",
                    labelCatatan: "Alasan Pembatalan *",
                    placeholder: "Alasan pembatalan...",
                    wajibCatatan: true,
                  })
                }
                className="text-danger hover:bg-danger/10 hover:text-danger"
              >
                <Ban className="mr-1.5 size-4" />
                Batalkan WO
              </Button>
            )}
          </>
        )}

        {/* 4. Status: SELESAI (Pemeriksaan QC) */}
        {status === "selesai" && isKmOrOwner && (
          <>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() =>
                bukaDialog({
                  statusTujuan: "dikerjakan",
                  judul: "Hasil QC: Gagal",
                  deskripsi:
                    "Mobil akan dikembalikan ke status 'dikerjakan' agar mekanik memperbaiki keluhan yang belum beres.",
                  labelCatatan: "Catatan Kekurangan / QC Gagal *",
                  placeholder: "Contoh: Rem masih berbunyi, periksa master rem...",
                  wajibCatatan: true,
                })
              }
              className="border-danger text-danger hover:bg-danger/10"
            >
              <XCircle className="mr-1.5 size-4" />
              QC Gagal
            </Button>

            <Button
              disabled={loading}
              onClick={() => handleUbahStatus("siap_diambil", "QC Lulus")}
              className="bg-success text-white hover:bg-success/90"
            >
              {loading ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-1.5 size-4" />
              )}
              QC Lulus (Siap Diambil)
            </Button>
          </>
        )}

        {/* 5. Status: SIAP_DIAMBIL (Serahkan Mobil) */}
        {status === "siap_diambil" && isAdminOrOwner && (
          <Button
            disabled={loading || invoiceStatus !== "lunas" || fotoAkhirCount < 1}
            onClick={() => handleUbahStatus("diambil")}
            className="bg-emerald-700 text-white hover:bg-emerald-800"
            title={
              invoiceStatus !== "lunas"
                ? "Invoice belum lunas. Selesaikan pembayaran di tab Tagihan terlebih dahulu."
                : fotoAkhirCount < 1
                  ? "Unggah minimal 1 Foto Kondisi Akhir di Bagian C sebelum menyerahkan mobil."
                  : "Serahkan mobil ke pelanggan"
            }
          >
            {loading ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 size-4" />
            )}
            Serahkan Mobil
          </Button>
        )}
      </div>

      {/* Dialog Catatan / Konfirmasi */}
      <Dialog open={dialogBuka} onOpenChange={setDialogBuka}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogAksi?.judul}</DialogTitle>
            <DialogDescription>{dialogAksi?.deskripsi}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="catatan-dialog">{dialogAksi?.labelCatatan}</Label>
            <Textarea
              id="catatan-dialog"
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={dialogAksi?.placeholder}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogBuka(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={loading || (dialogAksi?.wajibCatatan && !catatan.trim())}
              onClick={() => {
                if (dialogAksi) {
                  handleUbahStatus(dialogAksi.statusTujuan, catatan.trim());
                }
              }}
              className="bg-primary text-white hover:bg-primary-strong"
            >
              {loading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
