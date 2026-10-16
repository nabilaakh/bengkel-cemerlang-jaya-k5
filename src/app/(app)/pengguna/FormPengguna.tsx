"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const skema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi"),
  role: z.enum(["owner", "admin", "kepala_mekanik"]),
  aktif: z.boolean(),
});

type DataForm = z.infer<typeof skema>;

export type ProfilPengguna = {
  id: string;
  nama: string;
  email: string;
  role: "owner" | "admin" | "kepala_mekanik";
  aktif: boolean;
  created_at: string;
};

type Props = {
  user: ProfilPengguna;
};

export function FormPengguna({ user }: Props) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: user.nama,
      role: user.role,
      aktif: user.aktif,
    },
  });

  async function simpan(data: DataForm) {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nama: data.nama,
          role: data.role,
          aktif: data.aktif,
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      toast.success(`Data pengguna ${data.nama} berhasil diperbarui`);
      setBuka(false);
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Gagal memperbarui pengguna.";
      toast.error(msg);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) {
          form.reset({
            nama: user.nama,
            role: user.role,
            aktif: user.aktif,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" />
          Ubah
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Akun Pengguna</DialogTitle>
          <DialogDescription>
            Email: <span className="font-medium text-text">{user.email}</span>
          </DialogDescription>
        </DialogHeader>
        <form id={`form-pengguna-${user.id}`} onSubmit={form.handleSubmit(simpan)} noValidate>
          <FieldGroup className="gap-4">
            <Controller
              name="nama"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`nama-${user.id}`}>Nama Lengkap *</FieldLabel>
                  <Input {...field} id={`nama-${user.id}`} placeholder="Nama pengguna" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="role"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={`role-${user.id}`}>Peran Akun *</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`role-${user.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner (Pemilik Bengkel)</SelectItem>
                      <SelectItem value="admin">Admin (Meja Depan & Kasir)</SelectItem>
                      <SelectItem value="kepala_mekanik">Kepala Mekanik (Pemimpin Tim)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              name="aktif"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id={`aktif-${user.id}`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <label
                    htmlFor={`aktif-${user.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Akun Aktif (Dapat login ke aplikasi)
                  </label>
                </div>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form={`form-pengguna-${user.id}`}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
