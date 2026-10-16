"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface DialogCatatPembayaranProps {
  invoiceId: string;
  nomorInvoice: string;
  total: number;
  terbayar: number;
  disabled?: boolean;
}

export function DialogCatatPembayaran({
  invoiceId,
  nomorInvoice,
  total,
  terbayar,
  disabled = false,
}: DialogCatatPembayaranProps) {
  const router = useRouter();
  const supabase = createClient();

  const sisa = Math.max(0, total - terbayar);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metode, setMetode] = useState<"tunai" | "transfer" | "qris">("tunai");
  const [jumlah, setJumlah] = useState<number>(sisa);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (jumlah <= 0) {
      toast.error("Jumlah pembayaran harus lebih dari 0");
      return;
    }

    if (jumlah > sisa) {
      toast.error(
        `Jumlah pembayaran (${rupiah(jumlah)}) melebihi sisa tagihan (${rupiah(sisa)})`
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("catat_pembayaran", {
        p_invoice: invoiceId,
        p_metode: metode,
        p_jumlah: jumlah,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(
        jumlah >= sisa
          ? "Pembayaran lunas berhasil dicatat!"
          : "Pembayaran sebagian berhasil dicatat"
      );
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mencatat pembayaran"
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
          setJumlah(sisa);
          setMetode("tunai");
        }
        setOpen(val);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-success text-white hover:bg-success/90 h-9 text-xs"
          disabled={disabled || sisa <= 0}
        >
          <CreditCard className="mr-1.5 size-3.5" />
          + Catat Pembayaran
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-text flex items-center gap-2">
            <CreditCard className="size-4 text-success" />
            Catat Pembayaran Invoice
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Catat pembayaran untuk invoice <strong>{nomorInvoice}</strong>.
            Pembayaran dapat dicatat sebagian atau langsung lunas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSimpan} className="space-y-4">
          <div className="bg-muted/40 p-3 rounded-lg border border-border text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-text-muted">Total Invoice:</span>
              <span className="font-mono text-text">{rupiah(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Sudah Terbayar:</span>
              <span className="font-mono text-text">{rupiah(terbayar)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1">
              <span className="font-medium text-text">Sisa Tagihan:</span>
              <span className="font-mono font-bold text-danger">
                {rupiah(sisa)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="select-metode" className="text-xs">
              Metode Pembayaran*
            </Label>
            <Select
              value={metode}
              onValueChange={(val) => setMetode(val as "tunai" | "transfer" | "qris")}
            >
              <SelectTrigger id="select-metode" className="text-xs h-9">
                <SelectValue placeholder="Pilih metode pembayaran..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tunai" className="text-xs">
                  Tunai (Cash)
                </SelectItem>
                <SelectItem value="transfer" className="text-xs">
                  Transfer Bank
                </SelectItem>
                <SelectItem value="qris" className="text-xs">
                  QRIS
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="input-jumlah-bayar" className="text-xs">
                Jumlah Pembayaran (Rp)*
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setJumlah(sisa)}
                className="h-6 text-[11px] text-primary hover:text-primary-strong p-0 hover:bg-transparent"
              >
                Bayar Lunas Penuh
              </Button>
            </div>
            <Input
              id="input-jumlah-bayar"
              type="number"
              min={1}
              max={sisa}
              step={1000}
              value={jumlah}
              onChange={(e) => setJumlah(Math.max(1, parseInt(e.target.value) || 0))}
              className="text-xs font-mono h-9"
              required
            />
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>Format: <strong>{rupiah(jumlah)}</strong></span>
              {jumlah === sisa ? (
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  Akan Lunas
                </span>
              ) : (
                <span>
                  Sisa setelah bayar: {rupiah(Math.max(0, sisa - jumlah))}
                </span>
              )}
            </div>
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
              disabled={loading || jumlah <= 0 || jumlah > sisa}
              className="text-xs bg-success text-white hover:bg-success/90"
            >
              {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Catat Pembayaran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
