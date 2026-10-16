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
  logoPath: string | null;
};

export function KelolaLogo({ logoPath }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const logoUrl = logoPath
    ? supabase.storage.from("publik").getPublicUrl(logoPath).data.publicUrl
    : null;

  async function unggahLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // 1. Kompresi gambar (PRD 11.4)
      const fileKompresi = await kompresiFoto(file);

      // 2. Unggah ke bucket 'publik' path 'logo/'
      const namaFile = `logo/${Date.now()}-${fileKompresi.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: errUpload } = await supabase.storage
        .from("publik")
        .upload(namaFile, fileKompresi, {
          cacheControl: "31536000",
          upsert: true,
        });

      if (errUpload) throw errUpload;

      // 3. Simpan path ke tabel workshop_settings
      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({ logo_path: namaFile })
        .eq("id", 1);

      if (errDb) throw errDb;

      // 4. Hapus file lama jika ada
      if (logoPath && logoPath !== namaFile) {
        await supabase.storage.from("publik").remove([logoPath]);
      }

      toast.success("Logo bengkel berhasil diperbarui");
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal mengunggah logo. Pastikan ukuran file sesuai ketentuan.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function hapusLogo() {
    if (!logoPath) return;

    setLoading(true);
    try {
      await supabase.storage.from("publik").remove([logoPath]);
      const { error: errDb } = await supabase
        .from("workshop_settings")
        .update({ logo_path: null })
        .eq("id", 1);

      if (errDb) throw errDb;

      toast.success("Logo bengkel berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal menghapus logo bengkel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo Bengkel</CardTitle>
        <CardDescription>
          Format WebP, JPEG, atau PNG (maks 1 MB). Logo digunakan pada sidebar, invoice, dan header publik.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 overflow-hidden">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo Bengkel"
                fill
                sizes="112px"
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <div className="text-center p-2">
                <ImagePlus className="mx-auto h-8 w-8 text-text-muted/60" />
                <span className="text-xs text-text-muted mt-1 block">Belum ada logo</span>
              </div>
            )}
          </div>

          <div className="space-y-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
              <label>
                <input
                  type="file"
                  accept="image/webp,image/jpeg,image/png"
                  className="hidden"
                  onChange={unggahLogo}
                  disabled={loading}
                />
                <Button variant="outline" asChild disabled={loading} className="cursor-pointer">
                  <span>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {logoPath ? "Ganti Logo" : "Unggah Logo"}
                  </span>
                </Button>
              </label>

              {logoPath && (
                <Button
                  variant="outline"
                  onClick={hapusLogo}
                  disabled={loading}
                  className="text-danger hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </Button>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Gambar akan otomatis dikompresi ke WebP sebelum diunggah ke storage publik.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
