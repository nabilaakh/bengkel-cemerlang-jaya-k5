"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const skema = z.object({
  nama: z.string().trim().min(1, "Nama bengkel wajib diisi"),
  alamat: z.string().trim().min(1, "Alamat bengkel wajib diisi"),
  telepon: z.string().trim().min(1, "Telepon bengkel wajib diisi"),
  jam_buka: z.string().trim().optional(),
});

type DataForm = z.infer<typeof skema>;

type Props = {
  data: {
    nama: string;
    alamat: string;
    telepon: string;
    jam_buka: string | null;
  };
};

export function FormBengkel({ data }: Props) {
  const router = useRouter();

  const form = useForm<DataForm>({
    resolver: zodResolver(skema),
    defaultValues: {
      nama: data.nama,
      alamat: data.alamat,
      telepon: data.telepon,
      jam_buka: data.jam_buka ?? "",
    },
  });

  async function simpan(nilai: DataForm) {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("workshop_settings")
        .update({
          nama: nilai.nama,
          alamat: nilai.alamat,
          telepon: nilai.telepon,
          jam_buka: nilai.jam_buka || null,
        })
        .eq("id", 1);

      if (error) throw error;

      toast.success("Informasi bengkel berhasil diperbarui");
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal menyimpan informasi bengkel. Coba lagi.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informasi Bengkel</CardTitle>
        <CardDescription>
          Data ini ditampilkan pada halaman depan, sidebar, dan kop invoice resmi bengkel.
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(simpan)} noValidate>
        <CardContent>
          <FieldGroup className="gap-4">
            <Controller
              name="nama"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="nama_bengkel">Nama Bengkel *</FieldLabel>
                  <Input {...field} id="nama_bengkel" placeholder="Cemerlang Jaya Motor" />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="alamat"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alamat_bengkel">Alamat Lengkap *</FieldLabel>
                  <Textarea
                    {...field}
                    id="alamat_bengkel"
                    rows={2}
                    placeholder="Jl. Raya Otomotif No. 123, Jakarta"
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                name="telepon"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="telepon_bengkel">Nomor Telepon / WhatsApp *</FieldLabel>
                    <Input {...field} id="telepon_bengkel" placeholder="081234567890" />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="jam_buka"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="jam_buka_bengkel">Jam Operasional</FieldLabel>
                    <Input {...field} id="jam_buka_bengkel" placeholder="Senin - Sabtu: 08:00 - 17:00" />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t pt-4 flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : "Simpan Informasi"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
