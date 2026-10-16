"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface DialogAturDiskonProps {
  workOrderId: string;
  diskonSaatIni: number;
  alasanSaatIni: string | null;
  subtotal: number;
  disabled?: boolean;
}

export function DialogAturDiskon({
  workOrderId,
  diskonSaatIni,
  alasanSaatIni,
  subtotal,
  disabled = false,
}: DialogAturDiskonProps) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diskon, setDiskon] = useState<number>(diskonSaatIni);
  const [alasan, setAlasan] = useState<string>(alasanSaatIni || "");

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (diskon < 0) {
      toast.error("Diskon tidak boleh bernilai negatif");
      return;
    }

    if (diskon > subtotal) {
      toast.error(
        `Diskon (${rupiah(diskon)}) tidak boleh melebihi subtotal tagihan (${rupiah(
          subtotal
        )})`
      );
      return;
    }

    if (diskon > 0 && !alasan.trim()) {
      toast.error("Alasan diskon wajib diisi bila terdapat potongan diskon");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("atur_diskon", {
        p_wo: workOrderId,
        p_diskon: diskon,
        p_alasan: diskon > 0 ? alasan.trim() : "",
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(
        diskon > 0 ? "Diskon tagihan berhasil diatur" : "Diskon berhasil dihapus"
      );
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengatur diskon tagihan"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (val) {
          setDiskon(diskonSaatIni);
          setAlasan(alasanSaatIni || "");
        }
        setOpen(val);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs border-border"
          disabled={disabled}
        >
          <Tag className="mr-1.5 size-3.5 text-primary" />
          {diskonSaatIni > 0 ? "Ubah Diskon" : "Atur Diskon"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-text flex items-center gap-2">
            <Tag className="size-4 text-primary" />
            Atur Diskon Tagihan
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Berikan diskon potongan harga untuk total tagihan Work Order ini.
            Diskon tidak boleh melebihi subtotal tagihan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSimpan} className="space-y-4">
          <div className="bg-muted/40 p-3 rounded-lg border border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal Tagihan:</span>
              <span className="font-mono font-medium text-text">
                {rupiah(subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Total Setelah Diskon:</span>
              <span className="font-mono font-semibold text-primary">
                {rupiah(Math.max(0, subtotal - diskon))}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-diskon" className="text-xs">
              Besaran Diskon (Rp)*
            </Label>
            <Input
              id="input-diskon"
              type="number"
              min={0}
              max={subtotal}
              step={1000}
              value={diskon}
              onChange={(e) => setDiskon(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-xs font-mono h-9"
            />
            <div className="text-[11px] text-text-muted">
              Format: <strong>{rupiah(diskon)}</strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="input-alasan-diskon" className="text-xs">
              Alasan Diskon {diskon > 0 ? "(Wajib)*" : "(Opsional)"}
            </Label>
            <Textarea
              id="input-alasan-diskon"
              placeholder="Contoh: Diskon pelanggan setia, promo hari kemerdekaan, dll..."
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className="text-xs min-h-20"
              required={diskon > 0}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
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
              Simpan Diskon
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
