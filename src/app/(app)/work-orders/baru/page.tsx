import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormWorkOrderBaru } from "./FormWorkOrderBaru";

export default async function HalamanWorkOrderBaru() {
  const profil = await ambilProfilSaya();

  // Hanya Admin dan Owner yang berhak membuat Work Order (PRD 6.7)
  if (profil.peran !== "admin" && profil.peran !== "owner") {
    redirect("/work-orders");
  }

  const supabase = await createClient();

  // Ambil daftar kepala mekanik yang aktif
  const { data: kepalaMekanikList } = await supabase
    .from("profiles")
    .select("id, nama")
    .eq("role", "kepala_mekanik")
    .eq("aktif", true)
    .order("nama");

  // Hitung jumlah WO aktif per tim
  const { data: woAktifList } = await supabase
    .from("work_orders")
    .select("kepala_mekanik_id")
    .in("status", ["menunggu", "dikerjakan", "tertunda"]);

  const hitunganWO: Record<string, number> = {};
  for (const item of woAktifList ?? []) {
    hitunganWO[item.kepala_mekanik_id] = (hitunganWO[item.kepala_mekanik_id] || 0) + 1;
  }

  const timOptions = (kepalaMekanikList ?? []).map((km) => ({
    id: km.id,
    nama: km.nama,
    woAktif: hitunganWO[km.id] || 0,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/work-orders">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-text">Buat Work Order Baru</h1>
          <p className="text-sm text-text-muted">
            Ketik plat nomor untuk mengambil atau mendaftarkan kendaraan
          </p>
        </div>
      </div>

      <FormWorkOrderBaru timOptions={timOptions} userId={profil.id} />
    </div>
  );
}
