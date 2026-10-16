"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { rupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface ItemTagihan {
  id: string;
  nama_item: string;
  jenis: string;
  harga_master: number;
  harga_dipakai: number;
  alasan_penyesuaian: string | null;
}

interface DialogSesuaikanHargaProps {
  item: ItemTagihan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PILIHAN_ALASAN = [
  "Harga khusus pelanggan",
  "Negosiasi",
  "Harga paket",
  "Koreksi harga master",
  "Lainnya",
];

export function DialogSesuaikanHarga({
  item,
  open,
  onOpenChange,
}: DialogSesuaikanHargaProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [hargaBaru, setHargaBaru] = useState<number>(item?.harga_dipakai ?? 0);
  const [kategoriAlasan, setKategoriAlasan] = useState<string>("Negosiasi");
  const [catatanAlasan, setCatatanAlasan] = useState<string>("");

  // Reset saat item berubah
  const handleOpen = (val: boolean) => {
    if (val && item) {
      setHargaBaru(item.harga_dipakai);
      setKategoriAlasan("Negosiasi");
      setCatatanAlasan(item.alasan_penyesuaian || "");
    }
    onOpenChange(val);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    if (hargaBaru < 0) {
      toast.error("Harga tidak boleh negatif");
      return;
    }

    const alasanLengkap =
      kategoriAlasan === "Lainnya"
        ? catatanAlasan.trim()
        : catatanAlasan.trim()
        ? `${kategoriAlasan}: ${catatanAlasan.trim()}`
        : kategoriAlasan;

    if (!alasanLengkap) {
      toast.error("Alasan penyesuaian harga wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const { data: diBawahModal, error } = await supabase.rpc(
        "sesuaikan_harga_item",
        {
          p_billing_item: item.id,
          p_harga: hargaBaru,
          p_alasan: alasanLengkap,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (diBawahModal) {
        toast.warning("Peringatan: Harga ini di bawah harga modal!", {
          description: "Harga berhasil disesuaikan, namun harap diperhatikan margin keuntungan.",
          duration: 6000,
        });
      } else {
        toast.success("Harga item berhasil disesuaikan");
      }

      onOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyesuaikan harga item"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-text flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            Sesuaikan Harga Item
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Ubah harga yang dipakai untuk <strong>{item.nama_item}</strong> pada
            Work Order ini. Penyesuaian wajib menyertakan alasan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSimpan} className="space-y-4">
          <div className="bg-muted/40 p-3 rounded-lg border border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Item:</span>
              <span className="font-medium text-text">{item.nama_item}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Harga Master:</span>
              <span className="font-mono text-text">{rupiah(item.harga_master)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Harga Dipakai Saat Ini:</span>
              <span className="font-mono text-primary font-medium">
                {rupiah(item.harga_dipakai)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-harga-baru" className="text-xs">
              Harga Baru (Rp)*
            </Label>
            <Input
              id="input-harga-baru"
              type="number"
              min={0}
              step={1000}
              value={hargaBaru}
              onChange={(e) => setHargaBaru(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-xs font-mono h-9"
              required
            />
            <div className="text-[11px] text-text-muted">
              Format: <strong>{rupiah(hargaBaru)}</strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="select-alasan" className="text-xs">
              Kategori Alasan*
            </Label>
            <Select value={kategoriAlasan} onValueChange={setKategoriAlasan}>
              <SelectTrigger id="select-alasan" className="text-xs h-9">
                <SelectValue placeholder="Pilih alasan penyesuaian..." />
              </SelectTrigger>
              <SelectContent>
                {PILIHAN_ALASAN.map((alasan) => (
                  <SelectItem key={alasan} value={alasan} className="text-xs">
                    {alasan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-catatan-alasan" className="text-xs">
              Keterangan Alasan {kategoriAlasan === "Lainnya" ? "(Wajib)*" : "(Opsional)"}
            </Label>
            <Textarea
              id="input-catatan-alasan"
              placeholder={
                kategoriAlasan === "Lainnya"
                  ? "Tuliskan alasan penyesuaian harga secara jelas..."
                  : "Catatan tambahan bila diperlukan..."
              }
              value={catatanAlasan}
              onChange={(e) => setCatatanAlasan(e.target.value)}
              className="text-xs min-h-20"
              required={kategoriAlasan === "Lainnya"}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="text-xs bg-primary text-white hover:bg-primary/90"
            >
              {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Simpan Penyesuaian
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
