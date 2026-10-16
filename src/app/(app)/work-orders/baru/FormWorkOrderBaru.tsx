"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  User,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { unggahFotoWorkOrder } from "@/lib/foto";

interface TimMekanik {
  id: string;
  nama: string;
  woAktif: number;
}

export function FormWorkOrderBaru({
  timOptions,
  userId,
}: {
  timOptions: TimMekanik[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  // Pencarian & Data Kendaraan/Pelanggan
  const [platInput, setPlatInput] = useState("");
  const [mencariPlat, setMencariPlat] = useState(false);
  const [statusPlat, setStatusPlat] = useState<"idle" | "ditemukan" | "baru">("idle");

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Form Pelanggan
  const [customerNama, setCustomerNama] = useState("");
  const [customerTelepon, setCustomerTelepon] = useState("");
  const [customerTipe, setCustomerTipe] = useState("perorangan");
  const [customerAlamat, setCustomerAlamat] = useState("");

  // Form Kendaraan
  const [vehiclePlat, setVehiclePlat] = useState("");
  const [vehicleMerekModel, setVehicleMerekModel] = useState("");
  const [vehicleTahun, setVehicleTahun] = useState("");
  const [vehicleWarna, setVehicleWarna] = useState("");
  const [vehicleTransmisi, setVehicleTransmisi] = useState<"AT" | "MT">("AT");

  // Bagian Data Masuk
  const [odometer, setOdometer] = useState("");
  const [keluhan, setKeluhan] = useState("");
  const [kepalaMekanikId, setKepalaMekanikId] = useState<string>(
    timOptions[0]?.id || "",
  );

  // Foto
  const [fotoStnk, setFotoStnk] = useState<File | null>(null);
  const [previewStnk, setPreviewStnk] = useState<string | null>(null);

  const [fotoAwal, setFotoAwal] = useState<File[]>([]);
  const [previewAwal, setPreviewAwal] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [pesanError, setPesanError] = useState<string | null>(null);

  // Input refs
  const stnkRef = useRef<HTMLInputElement>(null);
  const awalRef = useRef<HTMLInputElement>(null);

  // Cari Plat
  const handleCariPlat = async () => {
    const platRapi = platInput.toUpperCase().replace(/\s+/g, " ").trim();
    if (!platRapi) return;

    setMencariPlat(true);
    setPesanError(null);

    try {
      const { data: v, error } = await supabase
        .from("vehicles")
        .select("id, plat, merek_model, tahun, warna, transmisi, customer_id, customers (*)")
        .ilike("plat", platRapi)
        .maybeSingle();

      if (error) throw error;

      if (v) {
        setVehicleId(v.id);
        setVehiclePlat(v.plat);
        setVehicleMerekModel(v.merek_model);
        setVehicleTahun(v.tahun ? String(v.tahun) : "");
        setVehicleWarna(v.warna || "");
        setVehicleTransmisi((v.transmisi as "AT" | "MT") || "AT");

        if (v.customers) {
          setCustomerId(v.customers.id);
          setCustomerNama(v.customers.nama);
          setCustomerTelepon(v.customers.telepon);
          setCustomerTipe(v.customers.tipe);
          setCustomerAlamat(v.customers.alamat || "");
        }
        setStatusPlat("ditemukan");
        toast.success(`Plat ${v.plat} ditemukan atas nama ${v.customers?.nama}`);
      } else {
        setVehicleId(null);
        setCustomerId(null);
        setVehiclePlat(platRapi);
        setVehicleMerekModel("");
        setVehicleTahun("");
        setVehicleWarna("");
        setCustomerNama("");
        setCustomerTelepon("");
        setCustomerAlamat("");
        setStatusPlat("baru");
        toast.info("Plat belum terdaftar. Silakan lengkapi data pelanggan dan kendaraan.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mencari plat");
    } finally {
      setMencariPlat(false);
    }
  };

  // Pilih Foto STNK
  const handlePilihStnk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoStnk(file);
      setPreviewStnk(URL.createObjectURL(file));
    }
  };

  // Pilih Foto Kondisi Awal (1 - 6 foto)
  const handlePilihAwal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (fotoAwal.length + files.length > 6) {
      toast.error("Maksimal 6 foto kondisi awal");
      return;
    }

    const updated = [...fotoAwal, ...files].slice(0, 6);
    setFotoAwal(updated);
    setPreviewAwal(updated.map((f) => URL.createObjectURL(f)));
  };

  const handleHapusFotoAwal = (index: number) => {
    const updated = fotoAwal.filter((_, i) => i !== index);
    setFotoAwal(updated);
    setPreviewAwal(updated.map((f) => URL.createObjectURL(f)));
  };

  // Cek kelengkapan form
  const isLengkap =
    statusPlat !== "idle" &&
    (statusPlat === "ditemukan" ||
      (customerNama.trim() && customerTelepon.trim() && vehicleMerekModel.trim())) &&
    odometer !== "" &&
    Number(odometer) >= 0 &&
    keluhan.trim() !== "" &&
    kepalaMekanikId !== "" &&
    fotoStnk !== null &&
    fotoAwal.length >= 1;

  const bagianKurang: string[] = [];
  if (statusPlat === "idle") bagianKurang.push("Cari atau tentukan Plat Nomor");
  if (statusPlat === "baru") {
    if (!customerNama.trim()) bagianKurang.push("Nama Pelanggan");
    if (!customerTelepon.trim()) bagianKurang.push("Telepon Pelanggan");
    if (!vehicleMerekModel.trim()) bagianKurang.push("Merek & Model Kendaraan");
  }
  if (odometer === "" || Number(odometer) < 0) bagianKurang.push("Odometer (≥ 0)");
  if (!keluhan.trim()) bagianKurang.push("Keluhan");
  if (!kepalaMekanikId) bagianKurang.push("Pilihan Tim Kepala Mekanik");
  if (!fotoStnk) bagianKurang.push("Foto STNK (1 foto)");
  if (fotoAwal.length < 1) bagianKurang.push("Minimal 1 Foto Kondisi Awal");

  // Submit Work Order Baru
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLengkap) return;

    setSubmitting(true);
    setPesanError(null);

    try {
      let finalCustomerId = customerId;
      let finalVehicleId = vehicleId;

      // 1. Simpan Pelanggan Baru jika belum ada
      if (!finalCustomerId) {
        // Cek dulu apakah telepon sudah ada
        const { data: cExist } = await supabase
          .from("customers")
          .select("id")
          .eq("telepon", customerTelepon.trim())
          .maybeSingle();

        if (cExist) {
          finalCustomerId = cExist.id;
        } else {
          const { data: cNew, error: errC } = await supabase
            .from("customers")
            .insert({
              nama: customerNama.trim(),
              telepon: customerTelepon.trim(),
              tipe: customerTipe,
              alamat: customerAlamat.trim() || null,
            })
            .select("id")
            .single();

          if (errC) throw new Error(`Gagal menyimpan pelanggan: ${errC.message}`);
          finalCustomerId = cNew.id;
        }
      }

      // 2. Simpan Kendaraan Baru jika belum ada
      if (!finalVehicleId) {
        const { data: vNew, error: errV } = await supabase
          .from("vehicles")
          .insert({
            customer_id: finalCustomerId,
            plat: vehiclePlat.trim().toUpperCase(),
            merek_model: vehicleMerekModel.trim(),
            tahun: vehicleTahun ? Number(vehicleTahun) : null,
            warna: vehicleWarna.trim() || null,
            transmisi: vehicleTransmisi,
          })
          .select("id")
          .single();

        if (errV) throw new Error(`Gagal menyimpan kendaraan: ${errV.message}`);
        finalVehicleId = vNew.id;
      }

      // 3. Panggil RPC buat_work_order
      toast.info("Membuat nomor Work Order...");
      const { data: newWoId, error: errWo } = await supabase.rpc("buat_work_order", {
        p_vehicle_id: finalVehicleId,
        p_kepala_mekanik_id: kepalaMekanikId,
        p_odometer: Number(odometer),
        p_keluhan: keluhan.trim(),
      });

      if (errWo) throw new Error(errWo.message);
      if (!newWoId) throw new Error("Gagal mendapatkan ID Work Order baru");

      // 4. Kompres dan Unggah Foto STNK
      toast.info("Mengompres dan mengunggah Foto STNK...");
      if (fotoStnk) {
        await unggahFotoWorkOrder({
          supabase,
          workOrderId: newWoId,
          jenis: "stnk",
          file: fotoStnk,
          userId,
        });
      }

      // 5. Kompres dan Unggah Foto Kondisi Awal
      toast.info("Mengompres dan mengunggah Foto Kondisi Awal...");
      for (const file of fotoAwal) {
        await unggahFotoWorkOrder({
          supabase,
          workOrderId: newWoId,
          jenis: "kondisi_awal",
          file,
          userId,
        });
      }

      toast.success("Work Order berhasil dibuat!");
      router.push(`/work-orders/${newWoId}`);
    } catch (err: unknown) {
      console.error(err);
      const pesan = err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan Work Order";
      setPesanError(pesan);
      toast.error(pesan);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Pencarian Plat Nomor */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-text flex items-center gap-2">
            <Car className="size-4 text-primary" />
            1. Plat Nomor Kendaraan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 sm:max-w-md">
              <Input
                value={platInput}
                onChange={(e) => setPlatInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCariPlat())}
                placeholder="Contoh: B 1234 ABC"
                className="font-mono uppercase text-base"
                disabled={submitting}
                autoFocus
              />
            </div>
            <Button
              type="button"
              onClick={handleCariPlat}
              disabled={mencariPlat || !platInput.trim() || submitting}
              className="bg-primary text-white hover:bg-primary-strong"
            >
              {mencariPlat ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 size-4" />
              )}
              Cari Plat
            </Button>
            {statusPlat !== "idle" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusPlat("idle");
                  setPlatInput("");
                  setVehicleId(null);
                  setCustomerId(null);
                }}
              >
                Ganti Plat
              </Button>
            )}
          </div>

          {statusPlat === "ditemukan" && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" />
              <span>Plat terdaftar. Data pelanggan dan kendaraan terisi otomatis.</span>
            </div>
          )}

          {statusPlat === "baru" && (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertCircle className="size-4" />
              <span>Plat belum terdaftar. Silakan lengkapi rincian di bawah ini.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Informasi Pelanggan dan Kendaraan */}
      {statusPlat !== "idle" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Kartu Pelanggan */}
          <Card className="border-border bg-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
                <User className="size-4 text-primary" />
                Data Pelanggan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="cust-nama" className="text-xs">
                  Nama Pelanggan *
                </Label>
                <Input
                  id="cust-nama"
                  value={customerNama}
                  onChange={(e) => setCustomerNama(e.target.value)}
                  disabled={statusPlat === "ditemukan" || submitting}
                  placeholder="Nama lengkap pemilik"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="cust-telepon" className="text-xs">
                  No. Telepon / WhatsApp *
                </Label>
                <Input
                  id="cust-telepon"
                  value={customerTelepon}
                  onChange={(e) => setCustomerTelepon(e.target.value)}
                  disabled={statusPlat === "ditemukan" || submitting}
                  placeholder="08123456789"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label htmlFor="cust-tipe" className="text-xs">
                  Tipe Pelanggan
                </Label>
                <Select
                  value={customerTipe}
                  onValueChange={setCustomerTipe}
                  disabled={statusPlat === "ditemukan" || submitting}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perorangan">Perorangan</SelectItem>
                    <SelectItem value="perusahaan">Perusahaan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cust-alamat" className="text-xs">
                  Alamat (opsional)
                </Label>
                <Input
                  id="cust-alamat"
                  value={customerAlamat}
                  onChange={(e) => setCustomerAlamat(e.target.value)}
                  disabled={statusPlat === "ditemukan" || submitting}
                  placeholder="Kota / Alamat singkat"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Kartu Kendaraan */}
          <Card className="border-border bg-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
                <Car className="size-4 text-primary" />
                Data Kendaraan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="veh-plat" className="text-xs">
                    Plat Nomor *
                  </Label>
                  <Input
                    id="veh-plat"
                    value={vehiclePlat}
                    disabled
                    className="mt-1 font-mono font-semibold"
                  />
                </div>
                <div>
                  <Label htmlFor="veh-transmisi" className="text-xs">
                    Transmisi
                  </Label>
                  <Select
                    value={vehicleTransmisi}
                    onValueChange={(v) => setVehicleTransmisi(v as "AT" | "MT")}
                    disabled={statusPlat === "ditemukan" || submitting}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AT">Otomatis (AT)</SelectItem>
                      <SelectItem value="MT">Manual (MT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="veh-merek" className="text-xs">
                  Merek dan Model *
                </Label>
                <Input
                  id="veh-merek"
                  value={vehicleMerekModel}
                  onChange={(e) => setVehicleMerekModel(e.target.value)}
                  disabled={statusPlat === "ditemukan" || submitting}
                  placeholder="Contoh: Toyota Avanza 1.3 G"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="veh-tahun" className="text-xs">
                    Tahun
                  </Label>
                  <Input
                    id="veh-tahun"
                    type="number"
                    value={vehicleTahun}
                    onChange={(e) => setVehicleTahun(e.target.value)}
                    disabled={statusPlat === "ditemukan" || submitting}
                    placeholder="2020"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="veh-warna" className="text-xs">
                    Warna
                  </Label>
                  <Input
                    id="veh-warna"
                    value={vehicleWarna}
                    onChange={(e) => setVehicleWarna(e.target.value)}
                    disabled={statusPlat === "ditemukan" || submitting}
                    placeholder="Hitam Metalik"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Bagian Data Masuk (Keluhan, Odometer, Tim) */}
      {statusPlat !== "idle" && (
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-text">
              2. Data Masuk Servis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="wo-odometer" className="text-xs">
                  Odometer Saat Datang (KM) *
                </Label>
                <Input
                  id="wo-odometer"
                  type="number"
                  min="0"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  placeholder="Contoh: 45000"
                  className="mt-1 font-mono text-base"
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="wo-tim" className="text-xs">
                  Tim Kepala Mekanik *
                </Label>
                <Select
                  value={kepalaMekanikId}
                  onValueChange={setKepalaMekanikId}
                  disabled={submitting}
                >
                  <SelectTrigger id="wo-tim" className="mt-1">
                    <SelectValue placeholder="Pilih Tim" />
                  </SelectTrigger>
                  <SelectContent>
                    {timOptions.map((tim) => (
                      <SelectItem key={tim.id} value={tim.id}>
                        {tim.nama} · {tim.woAktif} WO aktif
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="wo-keluhan" className="text-xs">
                Keluhan Pelanggan *
              </Label>
              <Textarea
                id="wo-keluhan"
                rows={3}
                value={keluhan}
                onChange={(e) => setKeluhan(e.target.value)}
                placeholder="Tuliskan keluhan atau permintaan servis mobil..."
                className="mt-1"
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Foto STNK dan Foto Kondisi Awal */}
      {statusPlat !== "idle" && (
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-text">
              3. Dokumentasi Foto Masuk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Foto STNK */}
            <div>
              <Label className="text-xs font-medium">Foto STNK * (1 foto)</Label>
              <p className="text-xs text-text-muted mb-2">
                Foto identitas kendaraan dan STNK untuk arsip privat
              </p>

              <input
                ref={stnkRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePilihStnk}
                className="hidden"
                disabled={submitting}
              />

              {previewStnk ? (
                <div className="relative inline-block overflow-hidden rounded-lg border border-border">
                  <img
                    src={previewStnk}
                    alt="STNK Preview"
                    className="h-36 w-48 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFotoStnk(null);
                      setPreviewStnk(null);
                    }}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => stnkRef.current?.click()}
                  disabled={submitting}
                  className="flex items-center gap-2"
                >
                  <Upload className="size-4" />
                  Unggah Foto STNK
                </Button>
              )}
            </div>

            {/* Foto Kondisi Awal */}
            <div>
              <Label className="text-xs font-medium">
                Foto Kondisi Awal * (1 sampai 6 foto)
              </Label>
              <p className="text-xs text-text-muted mb-2">
                Dokumentasikan bagian bodi, lecet awal, atau indikator mobil saat masuk
              </p>

              <input
                ref={awalRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePilihAwal}
                className="hidden"
                disabled={submitting || fotoAwal.length >= 6}
              />

              <div className="flex flex-wrap gap-3">
                {previewAwal.map((src, index) => (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={src}
                      alt={`Kondisi Awal ${index + 1}`}
                      className="h-28 w-28 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleHapusFotoAwal(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}

                {fotoAwal.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => awalRef.current?.click()}
                    disabled={submitting}
                    className="h-28 w-28 flex flex-col items-center justify-center gap-1 border-dashed"
                  >
                    <Upload className="size-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">+ Foto ({fotoAwal.length}/6)</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pesan Kesalahan / Validasi */}
      {pesanError && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{pesanError}</span>
        </div>
      )}

      {!isLengkap && statusPlat !== "idle" && (
        <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning flex items-start gap-2">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Lengkapi bagian berikut untuk menyimpan: </span>
            <span>{bagianKurang.join(", ")}.</span>
          </div>
        </div>
      )}

      {/* Tombol Simpan */}
      {statusPlat !== "idle" && (
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={!isLengkap || submitting}
            className="bg-primary px-8 text-white hover:bg-primary-strong"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Work Order"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
