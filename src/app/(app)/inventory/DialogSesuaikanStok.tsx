"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const skema = z.object({
  stok_fisik: z.number().int().min(0, "Stok fisik tidak boleh negatif"),
  alasan: z.string().trim().min(1, "Alasan penyesuaian stok wajib diisi"),
});

type DataForm = z.infer<typeof skema>;

type Props = {
  itemId: string;
  namaItem: string;
  kodeItem: string;
  stokTercatat: number;
};

export function DialogSesuaikanStok({ itemId, namaItem, kodeItem, stokTercatat }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      stok_fisik: stokTercatat,
      alasan: "",
    },
  });

  const stokFisikInput = form.watch("stok_fisik");
  const selisih = (Number(stokFisikInput) || 0) - stokTercatat;

  async function simpan(data: DataForm) {
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc("sesuaikan_stok", {
        p_item: itemId,
        p_stok_fisik: data.stok_fisik,
        p_alasan: data.alasan,
      });

      if (error) throw error;

      toast.success(
        `Stok berhasil disesuaikan menjadi ${data.stok_fisik} unit (${selisih >= 0 ? "+" : ""}${selisih})`,
      );
      setBuka(false);
      form.reset({ stok_fisik: data.stok_fisik, alasan: "" });
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Gagal menyesuaikan stok. Hanya Owner yang berhak.",
      );
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) {
          form.reset({ stok_fisik: stokTercatat, alasan: "" });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-warning hover:text-warning">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Sesuaikan Stok
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok (Stock Opname)</DialogTitle>
          <DialogDescription>
            {kodeItem} · <span className="font-semibold text-text">{namaItem}</span>
            <br />
            Stok di sistem saat ini:{" "}
            <span className="font-medium text-text">{stokTercatat} unit</span>
          </DialogDescription>
        </DialogHeader>
        <form id={`form-sesuaikan-${itemId}`} onSubmit={form.handleSubmit(simpan)} noValidate>
          <FieldGroup className="gap-4">
            <Controller
              name="stok_fisik"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`stok-fisik-${itemId}`}>
                    Stok Hasil Hitung Fisik *
                  </FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    id={`stok-fisik-${itemId}`}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    placeholder="Masukkan jumlah fisik aktual"
                  />
                  <FieldError errors={[fieldState.error]} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Selisih penyesuaian:{" "}
                    <span
                      className={
                        selisih > 0
                          ? "text-success font-semibold"
                          : selisih < 0
                            ? "text-danger font-semibold"
                            : "font-semibold"
                      }
                    >
                      {selisih > 0 ? `+${selisih}` : selisih} unit
                    </span>
                  </p>
                </Field>
              )}
            />

            <Controller
              name="alasan"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`alasan-sesuaikan-${itemId}`}>
                    Alasan Penyesuaian *
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id={`alasan-sesuaikan-${itemId}`}
                    rows={2}
                    placeholder="Contoh: Selisih opname fisik bulanan / barang rusak"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form={`form-sesuaikan-${itemId}`}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Menyimpan..." : "Simpan Penyesuaian"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
