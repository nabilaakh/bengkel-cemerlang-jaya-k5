"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Car,
  MessageCircle,
  FileText,
  Gauge,
  Stethoscope,
  Pencil,
  Check,
  X,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

interface BagianDataMasukProps {
  workOrderId: string;
  status: string;
  customer: {
    id: string;
    nama: string;
    telepon: string;
    tipe: string;
    alamat: string | null;
  } | null;
  vehicle: {
    id: string;
    plat: string;
    merek_model: string;
    tahun: number | null;
    warna: string | null;
    transmisi: string | null;
  } | null;
  odometer: number;
  keluhan: string;
  diagnosis: string | null;
  peranSaya: "owner" | "admin" | "kepala_mekanik";
  kepalaMekanikId: string;
  userId: string;
  fotoStnk?: { path: string; signedUrl: string } | null;
  fotoKondisiAwal: { path: string; signedUrl: string }[];
}

export function BagianDataMasuk({
  workOrderId,
  status,
  customer,
  vehicle,
  odometer: initOdo,
  keluhan: initKeluhan,
  diagnosis: initDiagnosis,
  peranSaya,
  kepalaMekanikId,
  userId,
  fotoStnk,
  fotoKondisiAwal,
}: BagianDataMasukProps) {
  const router = useRouter();
  const supabase = createClient();

  // Mode Edit Odometer & Keluhan (Admin/Owner saat menunggu)
  const bolehEditKeluhan =
    status === "menunggu" && (peranSaya === "admin" || peranSaya === "owner");
  const [editKeluhan, setEditKeluhan] = useState(false);
  const [odometerVal, setOdometerVal] = useState(String(initOdo));
  const [keluhanVal, setKeluhanVal] = useState(initKeluhan);
  const [savingKeluhan, setSavingKeluhan] = useState(false);

  // Mode Edit Diagnosis (KM tim ini/Owner saat dikerjakan/tertunda)
  const isKmTimIni = peranSaya === "kepala_mekanik" && kepalaMekanikId === userId;
  const bolehEditDiagnosis =
    ["dikerjakan", "tertunda"].includes(status) && (isKmTimIni || peranSaya === "owner");
  const [editDiagnosis, setEditDiagnosis] = useState(false);
  const [diagnosisVal, setDiagnosisVal] = useState(initDiagnosis || "");
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);

  // Modal Preview Foto
  const [fotoAktif, setFotoAktif] = useState<{ url: string; judul: string } | null>(null);

  // Simpan Odometer & Keluhan
  const handleSimpanKeluhan = async () => {
    if (Number(odometerVal) < 0 || !keluhanVal.trim()) {
      toast.error("Odometer (≥ 0) dan keluhan wajib diisi");
      return;
    }
    setSavingKeluhan(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          odometer: Number(odometerVal),
          keluhan: keluhanVal.trim(),
        })
        .eq("id", workOrderId);

      if (error) throw error;
      toast.success("Data masuk berhasil diperbarui");
      setEditKeluhan(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui data masuk");
    } finally {
      setSavingKeluhan(false);
    }
  };

  // Simpan Diagnosis
  const handleSimpanDiagnosis = async () => {
    setSavingDiagnosis(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({
          diagnosis: diagnosisVal.trim() || null,
        })
        .eq("id", workOrderId);

      if (error) throw error;
      toast.success("Diagnosis berhasil disimpan");
      setEditDiagnosis(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan diagnosis");
    } finally {
      setSavingDiagnosis(false);
    }
  };

  // WhatsApp Link
  const noHp = customer?.telepon?.replace(/\D/g, "") || "";
  const noWa = noHp.startsWith("0") ? `62${noHp.slice(1)}` : noHp;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Bagian A. Data Masuk</h2>
      </div>

      {/* Kartu Pelanggan & Kartu Kendaraan */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pelanggan */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-text flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="size-4 text-primary" />
                Data Pelanggan
              </span>
              {customer?.telepon && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                  asChild
                >
                  <a
                    href={`https://wa.me/${noWa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-1 size-3.5" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-text-muted text-xs block">Nama</span>
              <span className="font-semibold text-text">{customer?.nama || "-"}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block">No. Telepon</span>
              <span className="font-mono text-text">{customer?.telepon || "-"}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block">Tipe / Alamat</span>
              <span className="text-text-body capitalize">
                {customer?.tipe || "Perorangan"}
                {customer?.alamat ? ` · ${customer.alamat}` : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Kendaraan */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
              <Car className="size-4 text-primary" />
              Data Kendaraan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-baseline">
              <div>
                <span className="text-text-muted text-xs block">Plat Nomor</span>
                <span className="font-mono font-bold text-base text-primary">
                  {vehicle?.plat || "-"}
                </span>
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                {vehicle?.transmisi ? `Transmisi ${vehicle.transmisi}` : "-"}
              </span>
            </div>
            <div>
              <span className="text-text-muted text-xs block">Merek dan Model</span>
              <span className="font-medium text-text">{vehicle?.merek_model || "-"}</span>
            </div>
            <div className="flex gap-4">
              <div>
                <span className="text-text-muted text-xs block">Tahun</span>
                <span className="text-text">{vehicle?.tahun || "-"}</span>
              </div>
              <div>
                <span className="text-text-muted text-xs block">Warna</span>
                <span className="text-text">{vehicle?.warna || "-"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Odometer & Keluhan */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
              <Gauge className="size-4 text-primary" />
              Kondisi Masuk & Keluhan
            </CardTitle>
            {bolehEditKeluhan && !editKeluhan && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditKeluhan(true)}
                className="h-7 text-xs text-primary"
              >
                <Pencil className="mr-1 size-3" />
                Ubah Data Masuk
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {editKeluhan ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-odo" className="text-xs">
                  Odometer (KM)
                </Label>
                <Input
                  id="edit-odo"
                  type="number"
                  value={odometerVal}
                  onChange={(e) => setOdometerVal(e.target.value)}
                  className="mt-1 font-mono sm:max-w-xs"
                />
              </div>
              <div>
                <Label htmlFor="edit-kel" className="text-xs">
                  Keluhan
                </Label>
                <Textarea
                  id="edit-kel"
                  rows={3}
                  value={keluhanVal}
                  onChange={(e) => setKeluhanVal(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSimpanKeluhan}
                  disabled={savingKeluhan}
                  className="bg-primary text-white hover:bg-primary-strong"
                >
                  {savingKeluhan ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Check className="mr-1 size-3" />
                  )}
                  Simpan Perubahan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditKeluhan(false);
                    setOdometerVal(String(initOdo));
                    setKeluhanVal(initKeluhan);
                  }}
                  disabled={savingKeluhan}
                >
                  <X className="mr-1 size-3" />
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="text-text-muted text-xs block">Odometer Masuk</span>
                <span className="font-mono text-base font-semibold text-text">
                  {initOdo.toLocaleString("id-ID")} KM
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-text-muted text-xs block">Keluhan Pelanggan</span>
                <p className="mt-1 text-sm text-text whitespace-pre-wrap">
                  {initKeluhan || "-"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnosis Teknis */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
              <Stethoscope className="size-4 text-primary" />
              Diagnosis Mekanik
            </CardTitle>
            {bolehEditDiagnosis && !editDiagnosis && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditDiagnosis(true)}
                className="h-7 text-xs text-primary"
              >
                <Pencil className="mr-1 size-3" />
                {initDiagnosis ? "Ubah Diagnosis" : "Isi Diagnosis"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editDiagnosis ? (
            <div className="space-y-3">
              <Textarea
                rows={3}
                value={diagnosisVal}
                onChange={(e) => setDiagnosisVal(e.target.value)}
                placeholder="Tuliskan hasil pengecekan / temuan teknis mekanik..."
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSimpanDiagnosis}
                  disabled={savingDiagnosis}
                  className="bg-primary text-white hover:bg-primary-strong"
                >
                  {savingDiagnosis ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Check className="mr-1 size-3" />
                  )}
                  Simpan Diagnosis
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditDiagnosis(false);
                    setDiagnosisVal(initDiagnosis || "");
                  }}
                  disabled={savingDiagnosis}
                >
                  <X className="mr-1 size-3" />
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text whitespace-pre-wrap">
              {initDiagnosis || (
                <span className="italic text-text-muted">
                  Belum ada catatan diagnosis teknis.
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dokumentasi Foto Masuk (STNK & Kondisi Awal) */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" />
            Foto STNK & Kondisi Awal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-4">
            {/* STNK */}
            <div>
              <span className="text-text-muted text-xs block mb-1 font-medium">Foto STNK</span>
              {fotoStnk?.signedUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    setFotoAktif({ url: fotoStnk.signedUrl, judul: "Foto STNK" })
                  }
                  className="group relative block overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={fotoStnk.signedUrl}
                    alt="Foto STNK"
                    className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition-opacity">
                    Perbesar
                  </div>
                </button>
              ) : (
                <div className="h-28 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-text-muted">
                  Tidak ada foto
                </div>
              )}
            </div>

            {/* Kondisi Awal */}
            <div className="sm:col-span-3">
              <span className="text-text-muted text-xs block mb-1 font-medium">
                Foto Kondisi Awal ({fotoKondisiAwal.length})
              </span>
              {fotoKondisiAwal.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {fotoKondisiAwal.map((f, i) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() =>
                        setFotoAktif({
                          url: f.signedUrl,
                          judul: `Foto Kondisi Awal #${i + 1}`,
                        })
                      }
                      className="group relative block overflow-hidden rounded-lg border border-border"
                    >
                      <img
                        src={f.signedUrl}
                        alt={`Kondisi Awal ${i + 1}`}
                        className="h-28 w-28 object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition-opacity">
                        #{i + 1}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-28 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-text-muted">
                  Tidak ada foto kondisi awal
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Preview Foto Penuh */}
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
