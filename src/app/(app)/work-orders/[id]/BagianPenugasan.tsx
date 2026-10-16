"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Calendar, Check, AlertCircle, Loader2, Star, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { tanggal } from "@/lib/format";

interface MekanikItem {
  id: string;
  nama: string;
  woAktif: number;
}

interface BagianPenugasanProps {
  workOrderId: string;
  status: string;
  kepalaMekanikId: string;
  kepalaMekanikNama: string;
  estimasiSelesai: string | null;
  mekanikDitugaskan: { id: string; nama: string }[];
  peranSaya: "owner" | "admin" | "kepala_mekanik";
  userId: string;
  daftarMekanikTim: MekanikItem[];
  daftarSemuaTim: { id: string; nama: string }[];
}

export function BagianPenugasan({
  workOrderId,
  status,
  kepalaMekanikId,
  kepalaMekanikNama,
  estimasiSelesai: initEstimasi,
  mekanikDitugaskan: initMekanik,
  peranSaya,
  userId,
  daftarMekanikTim,
  daftarSemuaTim,
}: BagianPenugasanProps) {
  const router = useRouter();
  const supabase = createClient();

  const isKmTimIni = peranSaya === "kepala_mekanik" && kepalaMekanikId === userId;
  const bolehTugaskan = status === "menunggu" && (isKmTimIni || peranSaya === "owner");
  const bolehPindahTim = status === "menunggu" && (peranSaya === "admin" || peranSaya === "owner");

  // State Penugasan Mekanik
  const [selectedMekanik, setSelectedMekanik] = useState<string[]>(
    initMekanik.map((m) => m.id),
  );
  const [estimasi, setEstimasi] = useState<string>(
    initEstimasi || new Date().toISOString().split("T")[0],
  );
  const [savingTugas, setSavingTugas] = useState(false);

  // State Pindah Tim (Admin/Owner)
  const [timTujuanId, setTimTujuanId] = useState<string>(kepalaMekanikId);
  const [savingTim, setSavingTim] = useState(false);

  const toggleMekanik = (id: string) => {
    if (selectedMekanik.includes(id)) {
      setSelectedMekanik(selectedMekanik.filter((m) => m !== id));
    } else {
      if (selectedMekanik.length >= 3) {
        toast.error("Maksimal 3 mekanik yang dapat ditugaskan");
        return;
      }
      setSelectedMekanik([...selectedMekanik, id]);
    }
  };

  // Simpan Penugasan Mekanik
  const handleSimpanPenugasan = async () => {
    if (selectedMekanik.length < 1) {
      toast.error("Pilih minimal 1 mekanik");
      return;
    }
    if (!estimasi) {
      toast.error("Tanggal estimasi selesai wajib diisi");
      return;
    }

    setSavingTugas(true);
    try {
      const { error } = await supabase.rpc("tugaskan_mekanik", {
        p_wo: workOrderId,
        p_mekanik: selectedMekanik,
        p_estimasi: estimasi,
      });

      if (error) throw error;
      toast.success("Penugasan mekanik berhasil disimpan");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan penugasan");
    } finally {
      setSavingTugas(false);
    }
  };

  // Pindah Tim Kepala Mekanik
  const handlePindahTim = async () => {
    if (timTujuanId === kepalaMekanikId) return;

    setSavingTim(true);
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ kepala_mekanik_id: timTujuanId })
        .eq("id", workOrderId);

      if (error) throw error;
      toast.success("Tim Kepala Mekanik berhasil dipindahkan");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Gagal memindahkan tim");
    } finally {
      setSavingTim(false);
    }
  };

  const hariIniStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Bagian B. Penugasan</h2>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-text flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Penugasan Tim & Mekanik
            </span>
            <span className="text-xs font-normal text-text-muted">
              Tim: <span className="font-semibold text-text">{kepalaMekanikNama}</span>
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Fitur Admin/Owner: Pindahkan Tim saat menunggu */}
          {bolehPindahTim && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs font-medium text-text-body block mb-2">
                Pindahkan ke Tim Lain (selama status Menunggu):
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={timTujuanId} onValueChange={setTimTujuanId}>
                  <SelectTrigger className="w-56 h-8 text-xs bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {daftarSemuaTim.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {timTujuanId !== kepalaMekanikId && (
                  <Button
                    size="sm"
                    onClick={handlePindahTim}
                    disabled={savingTim}
                    className="h-8 text-xs bg-primary text-white hover:bg-primary-strong"
                  >
                    {savingTim ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      "Terapkan Pindah Tim"
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Form Penugasan Mekanik jika bolehTugaskan */}
          {bolehTugaskan ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-text block mb-1">
                  Pilih Mekanik Tim {kepalaMekanikNama} (1 sampai 3 orang) *
                </Label>
                <p className="text-xs text-text-muted mb-3">
                  Urutan berdasarkan beban kerja paling ringan
                </p>

                {daftarMekanikTim.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {daftarMekanikTim.map((m, idx) => {
                      const checked = selectedMekanik.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleMekanik(m.id)}
                          className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                            checked
                              ? "border-primary bg-primary-soft/30 text-primary-strong"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox checked={checked} onCheckedChange={() => toggleMekanik(m.id)} />
                            <span className="text-sm font-medium text-text">{m.nama}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-text-muted">
                            <span>{m.woAktif} WO aktif</span>
                            {idx === 0 && (
                              <Star className="size-3 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs italic text-text-muted">
                    Belum ada anggota mekanik aktif di tim ini.
                  </p>
                )}
              </div>

              {/* Tanggal Estimasi Selesai */}
              <div className="sm:max-w-xs">
                <Label htmlFor="tgl-estimasi" className="text-xs font-semibold text-text block mb-1">
                  Estimasi Selesai *
                </Label>
                <div className="relative">
                  <Input
                    id="tgl-estimasi"
                    type="date"
                    min={hariIniStr}
                    value={estimasi}
                    onChange={(e) => setEstimasi(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Tombol Simpan Penugasan */}
              <Button
                onClick={handleSimpanPenugasan}
                disabled={savingTugas || selectedMekanik.length < 1 || !estimasi}
                className="bg-primary text-white hover:bg-primary-strong"
              >
                {savingTugas ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 size-4" />
                )}
                Simpan Penugasan
              </Button>
            </div>
          ) : (
            /* Tampilan Baca Saja jika sudah dikerjakan atau bukan KM/Owner */
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-text-muted text-xs block mb-1">Mekanik yang Ditugaskan</span>
                {initMekanik.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {initMekanik.map((m) => (
                      <span
                        key={m.id}
                        className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-text"
                      >
                        {m.nama}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="italic text-xs text-text-muted">
                    Belum ada mekanik yang ditugaskan.
                  </span>
                )}
              </div>

              <div>
                <span className="text-text-muted text-xs block mb-1">Estimasi Selesai</span>
                <span className="font-semibold text-sm text-text">
                  {initEstimasi ? tanggal(initEstimasi) : "-"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
