"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import type { Peran } from "@/lib/peran";

const skema = z.object({
  nama: z.string().trim().min(1, "Nama item wajib diisi"),
  kode: z.string().trim(),
  harga_jual: z.number().min(0, "Harga jual minimal 0"),
  stok_minimum: z.number().min(0, "Stok minimum minimal 0"),
  harga_modal: z.number().min(0, "Harga modal minimal 0").optional(),
  aktif: z.boolean(),
});

type DataForm = z.infer<typeof skema>;

export type ItemInventory = {
  id: string;
  kode: string;
  nama: string;
  jenis: "part" | "jasa";
  harga_jual: number;
  stok_minimum: number;
  aktif: boolean;
  harga_modal?: number | null;
};

type Props = {
  jenis: "part" | "jasa";
  item?: ItemInventory;
  peran: Peran;
};

export function FormItem({ jenis, item, peran }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: item?.nama ?? "",
      kode: item?.kode ?? "",
      harga_jual: item?.harga_jual ?? 0,
      stok_minimum: item?.stok_minimum ?? 5,
      harga_modal: item?.harga_modal ?? undefined,
      aktif: item?.aktif ?? true,
    },
  });

  const adalahOwner = peran === "owner";
  const labelJenis = jenis === "part" ? "Spare Part" : "Jasa";

  async function simpan(data: DataForm) {
    const supabase = createClient();

    try {
      if (item) {
        // Update item yang ada
        const { error: errItem } = await supabase
          .from("inventory_items")
          .update({
            nama: data.nama,
            harga_jual: data.harga_jual,
            stok_minimum: jenis === "part" ? data.stok_minimum : 0,
            aktif: data.aktif,
          })
          .eq("id", item.id);

        if (errItem) throw errItem;

        // Jika owner mengubah harga modal spare part
        if (adalahOwner && jenis === "part" && data.harga_modal !== undefined && data.harga_modal !== null) {
          const { error: errModal } = await supabase
            .from("inventory_costs")
            .upsert({
              item_id: item.id,
              harga_modal: data.harga_modal,
              updated_at: new Date().toISOString(),
            });

          if (errModal) throw errModal;
        }

        toast.success(`Data ${labelJenis} berhasil diperbarui`);
      } else {
        // Tambah item baru
        const barisItem = {
          jenis,
          nama: data.nama,
          harga_jual: data.harga_jual,
          stok_minimum: jenis === "part" ? data.stok_minimum : 0,
          aktif: true,
          kode: data.kode || "",
        };

        const { data: itemBaru, error: errItem } = await supabase
          .from("inventory_items")
          .insert(barisItem)
          .select("id")
          .single();

        if (errItem) {
          if (errItem.code === "23505") {
            form.setError("kode", { message: "Kode/SKU ini sudah digunakan" });
            return;
          }
          throw errItem;
        }

        // Jika owner mengisi harga modal awal spare part
        if (adalahOwner && jenis === "part" && data.harga_modal !== undefined && data.harga_modal !== null) {
          const { error: errModal } = await supabase
            .from("inventory_costs")
            .insert({
              item_id: itemBaru.id,
              harga_modal: data.harga_modal,
            });

          if (errModal) throw errModal;
        }

        toast.success(`${labelJenis} baru berhasil ditambahkan`);
      }

      setBuka(false);
      form.reset();
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error(`${labelJenis} gagal disimpan. Periksa kembali isian Anda.`);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) form.reset();
      }}
    >
      <DialogTrigger asChild>
        {item ? (
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5" />
            Ubah
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            {labelJenis}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? `Ubah ${labelJenis}` : `Tambah ${labelJenis}`}</DialogTitle>
        </DialogHeader>
        <form id={`form-item-${jenis}`} onSubmit={form.handleSubmit(simpan)} noValidate>
          <FieldGroup className="gap-4">
            <Controller
              name="nama"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="nama">Nama {labelJenis} *</FieldLabel>
                  <Input {...field} id="nama" placeholder={jenis === "part" ? "Oli Mesin 4L" : "Ganti Oli"} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {!item && (
              <Controller
                name="kode"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="kode">
                      {jenis === "part" ? "SKU / Kode Part" : "Kode Jasa"} (opsional)
                    </FieldLabel>
                    <Input
                      {...field}
                      id="kode"
                      placeholder={jenis === "part" ? "Otomatis SP-0001 bila kosong" : "Otomatis JS-0001 bila kosong"}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            <Controller
              name="harga_jual"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="harga_jual">
                    {jenis === "part" ? "Harga Jual (Rp) *" : "Tarif Jasa (Rp) *"}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    id="harga_jual"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    placeholder="Contoh: 150000"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {jenis === "part" && (
              <Controller
                name="stok_minimum"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="stok_minimum">Stok Minimum *</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      id="stok_minimum"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                      placeholder="Bawaan: 5"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            {adalahOwner && jenis === "part" && (
              <Controller
                name="harga_modal"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="harga_modal">
                      Harga Modal (Rp) <span className="text-xs text-muted-foreground font-normal">(Rahasia Owner)</span>
                    </FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      id="harga_modal"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value) || 0)}
                      placeholder="Contoh: 120000"
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            {item && (
              <Controller
                name="aktif"
                control={form.control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox
                      id="aktif"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <label
                      htmlFor="aktif"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Item Aktif (Dapat digunakan pada Work Order)
                    </label>
                  </div>
                )}
              />
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form={`form-item-${jenis}`} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
