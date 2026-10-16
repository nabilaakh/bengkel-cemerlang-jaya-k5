import { redirect } from "next/navigation";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormBengkel } from "./FormBengkel";
import { KelolaGaleri } from "./KelolaGaleri";
import { KelolaLogo } from "./KelolaLogo";

export default async function HalamanSetelan() {
  const profil = await ambilProfilSaya();

  // Hanya Owner yang boleh mengakses halaman Setelan Bengkel (PRD 6.11 & 10.2)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Hanya ambil kolom yang ditampilkan (hemat egress)
  const { data: setelan, error } = await supabase
    .from("workshop_settings")
    .select("nama, alamat, telepon, jam_buka, logo_path, galeri_paths")
    .eq("id", 1)
    .single();

  if (error || !setelan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
          Data setelan bengkel gagal dimuat. Muat ulang halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text">Setelan Bengkel</h1>
        <p className="text-sm text-text-muted">
          Kelola profil bengkel, identitas visual logo, dan galeri foto halaman depan.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Form Informasi Utama Bengkel */}
        <FormBengkel
          data={{
            nama: setelan.nama,
            alamat: setelan.alamat,
            telepon: setelan.telepon,
            jam_buka: setelan.jam_buka,
          }}
        />

        {/* Pengelolaan Logo di Bucket Publik */}
        <KelolaLogo logoPath={setelan.logo_path} />

        {/* Pengelolaan Galeri Foto di Bucket Publik */}
        <KelolaGaleri galeriPaths={setelan.galeri_paths ?? []} />
      </div>
    </div>
  );
}
