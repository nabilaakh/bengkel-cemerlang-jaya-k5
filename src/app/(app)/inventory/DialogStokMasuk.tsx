"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDownToLine } from "lucide-react";
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
  jumlah: z.number().int().min(1, "Jumlah minimal 1"),
  keterangan: z.string().trim(),
});

type DataForm = z.infer<typeof skema>;

type Props = {
  itemId: string;
  namaItem: string;
  kodeItem: string;
  stokSaatIni: number;
};

export function DialogStokMasuk({ itemId, namaItem, kodeItem, stokSaatIni }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      jumlah: 1,
      keterangan: "",
    },
  });

  async function simpan(data: DataForm) {
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc("catat_stok_masuk", {
        p_item: itemId,
        p_jumlah: data.jumlah,
        p_keterangan: data.keterangan || undefined,
      });

      if (error) throw error;

      toast.success(`Stok masuk berhasil dicatat (+${data.jumlah} unit)`);
      setBuka(false);
      form.reset({ jumlah: 1, keterangan: "" });
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mencatat stok masuk. Pastikan peran Anda memiliki hak akses.",
      );
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) form.reset({ jumlah: 1, keterangan: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-primary hover:text-primary">
          <ArrowDownToLine className="h-3.5 w-3.5" />
          Stok Masuk
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat Stok Masuk</DialogTitle>
          <DialogDescription>
            {kodeItem} · <span className="font-semibold text-text">{namaItem}</span>
            <br />
            Stok saat ini: <span className="font-medium text-text">{stokSaatIni} unit</span>
          </DialogDescription>
        </DialogHeader>
        <form id={`form-stok-masuk-${itemId}`} onSubmit={form.handleSubmit(simpan)} noValidate>
          <FieldGroup className="gap-4">
            <Controller
              name="jumlah"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`jumlah-masuk-${itemId}`}>Jumlah Masuk *</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    id={`jumlah-masuk-${itemId}`}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    placeholder="Minimal 1"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="keterangan"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={`keterangan-masuk-${itemId}`}>
                    Keterangan (misal nama toko/pembelian)
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id={`keterangan-masuk-${itemId}`}
                    rows={2}
                    placeholder="Contoh: Pembelian dari Toko Sinar"
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form={`form-stok-masuk-${itemId}`}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
