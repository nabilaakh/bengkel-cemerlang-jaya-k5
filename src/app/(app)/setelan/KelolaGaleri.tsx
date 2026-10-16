"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { kompresiFoto } from "@/lib/gambar";
import { createClient } from "@/lib/supabase/client";

type Props = {
  galeriPaths: string[];
};

export function KelolaGaleri({ galeriPaths }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function tambahFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (galeriPaths.length >= 6) {
      toast.error("Galeri maksimal berisi 6 foto.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    try {
      // 1. Kompresi gambar
      const fileKompresi = await kompresiFoto(file);

      // 2. Unggah ke bucket 'publik' folder 'galeri/'
      const namaFile = `galeri/${Date.now()}-${fileKompresi.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: errUpload } = await supabase.storage
        .from("publik")
        .upload(namaFile, fileKompresi, {
          cacheControl: "31536000",
          upsert: true,
        });

      if (errUpload) throw errUpload;

      // 3. Tambahkan path baru ke array galeri_paths di database
      const galeriBaru = [...galeriPaths, namaFile];
      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({ galeri_paths: galeriBaru })
        .eq("id", 1);

      if (errDb) throw errDb;

      toast.success("Foto berhasil ditambahkan ke galeri bengkel");
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal mengunggah foto ke galeri. Coba lagi.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function hapusFoto(path: string) {
    setLoading(true);
    try {
      // 1. Hapus dari storage
      await supabase.storage.from("publik").remove([path]);

      // 2. Hapus dari array di database
      const galeriBaru = galeriPaths.filter((p) => p !== path);
      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({ galeri_paths: galeriBaru })
        .eq("id", 1);

      if (errDb) throw errDb;

      toast.success("Foto berhasil dihapus dari galeri");
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal menghapus foto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Galeri Foto Halaman Depan</CardTitle>
            <CardDescription>
              Menampilkan suasana dan fasilitas bengkel pada halaman depan (3 hingga 6 foto).
            </CardDescription>
          </div>
          {galeriPaths.length < 6 && (
            <label>
              <input
                type="file"
                accept="image/webp,image/jpeg,image/png"
                className="hidden"
                onChange={tambahFoto}
                disabled={loading}
              />
              <Button asChild disabled={loading} className="cursor-pointer">
                <span>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Tambah Foto
                </span>
              </Button>
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {galeriPaths.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <ImagePlus className="mx-auto h-10 w-10 text-text-muted/60" />
            <p className="mt-2 text-sm font-medium text-text">Belum ada foto galeri</p>
            <p className="text-xs text-text-muted">
              Unggah 3 sampai 6 foto suasana bengkel untuk ditampilkan di halaman publik.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galeriPaths.map((path, idx) => {
              const url = supabase.storage.from("publik").getPublicUrl(path).data.publicUrl;
              return (
                <div
                  key={path}
                  className="group relative aspect-4/3 rounded-xl border border-border bg-muted/30 overflow-hidden shadow-xs"
                >
                  <Image
                    src={url}
                    alt={`Galeri ${idx + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => hapusFoto(path)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus
                    </Button>
                  </div>
                  <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
                    #{idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
          <span>{galeriPaths.length} dari 6 foto terunggah</span>
          {galeriPaths.length < 3 && (
            <span className="text-warning font-medium">Disarankan minimal 3 foto untuk galeri publik</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
