"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Package, Wrench, AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { rupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface ItemPilihan {
  id: string;
  kode: string;
  jenis: string;
  nama: string;
  harga_jual: number;
  stok: number;
}

interface DialogTambahItemProps {
  workOrderId: string;
  daftarItem: ItemPilihan[];
  disabled?: boolean;
}

export function DialogTambahItem({
  workOrderId,
  daftarItem,
  disabled = false,
}: DialogTambahItemProps) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [jumlah, setJumlah] = useState<number>(1);
  const [jenisFilter, setJenisFilter] = useState<"semua" | "part" | "jasa">("semua");
  const [pencarian, setPencarian] = useState("");

  const selectedItem = daftarItem.find((it) => it.id === selectedId);

  const itemTersaring = daftarItem.filter((it) => {
    if (jenisFilter !== "semua" && it.jenis !== jenisFilter) return false;
    if (pencarian.trim()) {
      const q = pencarian.toLowerCase();
      return (
        it.nama.toLowerCase().includes(q) ||
        it.kode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      toast.error("Pilih spare part atau jasa terlebih dahulu");
      return;
    }
    if (jumlah < 1) {
      toast.error("Jumlah minimal 1");
      return;
    }

    if (selectedItem?.jenis === "part" && selectedItem.stok < jumlah) {
      toast.error(`Stok ${selectedItem.nama} hanya ${selectedItem.stok}`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("tambah_item_tagihan", {
        p_wo: workOrderId,
        p_item: selectedId,
        p_jumlah: jumlah,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(
        `${selectedItem?.nama || "Item"} berhasil ditambahkan ke tagihan`
      );
      setOpen(false);
      setSelectedId("");
      setJumlah(1);
      setPencarian("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menambahkan item tagihan"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-primary text-white hover:bg-primary/90 h-9"
          disabled={disabled}
        >
          <Plus className="mr-1.5 size-4" />
          Tambah Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-text">
            Tambah Spare Part atau Jasa
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Pilih item dari inventory untuk ditambahkan ke tagihan Work Order ini.
            Stok spare part akan berkurang secara otomatis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSimpan} className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Filter Jenis & Pencarian */}
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant={jenisFilter === "semua" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setJenisFilter("semua")}
              >
                Semua
              </Button>
              <Button
                type="button"
                variant={jenisFilter === "part" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setJenisFilter("part")}
              >
                <Package className="mr-1 size-3" />
                Spare Part
              </Button>
              <Button
                type="button"
                variant={jenisFilter === "jasa" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setJenisFilter("jasa")}
              >
                <Wrench className="mr-1 size-3" />
                Jasa
              </Button>
            </div>
            <Input
              type="search"
              placeholder="Cari nama atau kode item (misal: Kampas, Oli, JS-0001)..."
              value={pencarian}
              onChange={(e) => setPencarian(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Daftar Item Pilihan */}
          <div className="flex-1 overflow-y-auto max-h-56 border border-border rounded-lg divide-y divide-border">
            {itemTersaring.length > 0 ? (
              itemTersaring.map((it) => {
                const isSelected = it.id === selectedId;
                const isPart = it.jenis === "part";
                const habis = isPart && it.stok <= 0;

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(it.id);
                      setJumlah(1);
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-xs transition-colors hover:bg-muted/50 ${
                      isSelected ? "bg-primary/10 border-l-4 border-l-primary" : ""
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text">{it.nama}</span>
                        <Badge variant="outline" className="text-[10px] uppercase h-4 px-1">
                          {it.jenis}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Kode: {it.kode} · Harga Jual: {rupiah(it.harga_jual)}
                      </div>
                    </div>
                    <div className="text-right">
                      {isPart ? (
                        <span
                          className={`text-xs font-mono font-medium ${
                            habis ? "text-danger" : "text-text"
                          }`}
                        >
                          Stok: {it.stok}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted font-medium">Tarif Tetap</span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-text-muted">
                Tidak ada spare part atau jasa yang cocok.
              </div>
            )}
          </div>

          {/* Input Jumlah */}
          {selectedItem && (
            <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text">
                  Item dipilih: <strong className="text-primary">{selectedItem.nama}</strong>
                </span>
                <span className="text-xs text-text-muted">
                  Harga master: {rupiah(selectedItem.harga_jual)}
                </span>
              </div>

              {selectedItem.jenis === "part" && selectedItem.stok <= 0 && (
                <div className="flex items-center gap-1.5 text-xs text-danger font-medium">
                  <AlertCircle className="size-3.5" />
                  Stok item ini habis (0). Tidak dapat ditambahkan.
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Label htmlFor="input-jumlah" className="text-xs min-w-16">
                  Jumlah:
                </Label>
                <Input
                  id="input-jumlah"
                  type="number"
                  min={1}
                  max={selectedItem.jenis === "part" ? selectedItem.stok : 99}
                  value={jumlah}
                  onChange={(e) => setJumlah(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 h-8 text-xs font-mono"
                  disabled={selectedItem.jenis === "part" && selectedItem.stok <= 0}
                />
                <span className="text-xs text-text-muted">
                  Subtotal:{" "}
                  <strong className="text-text font-mono">
                    {rupiah(selectedItem.harga_jual * jumlah)}
                  </strong>
                </span>
              </div>
            </div>
          )}

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
              disabled={
                loading ||
                !selectedId ||
                (selectedItem?.jenis === "part" && selectedItem.stok <= 0)
              }
              className="text-xs bg-primary text-white hover:bg-primary/90"
            >
              {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Tambahkan ke Tagihan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
