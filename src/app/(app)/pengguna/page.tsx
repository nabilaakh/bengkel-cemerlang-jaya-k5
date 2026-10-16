import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tanggal } from "@/lib/format";
import { LABEL_PERAN } from "@/lib/peran";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { FormPengguna, type ProfilPengguna } from "./FormPengguna";

const PER_HALAMAN = 20;

export default async function HalamanPengguna({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hal?: string }>;
}) {
  const { q = "", hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  // Hanya Owner yang boleh mengakses halaman Pengguna (PRD 6.10 & 10.2)
  if (profil.peran !== "owner") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  let kueri = supabase
    .from("profiles")
    .select("id, nama, email, role, aktif, created_at", { count: "exact" });

  if (cari) {
    kueri = kueri.or(`nama.ilike.%${cari}%,email.ilike.%${cari}%`);
  }

  const { data: pengguna, count = 0, error } = await kueri
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Pengguna dan Hak Akses</h1>
          <p className="text-sm text-text-muted">
            Kelola peran dan status aktif akun pengguna bengkel.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary-soft/30 p-4 text-sm text-primary-strong">
        <p className="font-medium">Cara Menambah Pengguna Baru (PRD 6.10):</p>
        <p className="text-xs text-text-body mt-1">
          1. Tambahkan user di Supabase Dashboard › Authentication › Users (centang <i>Auto Confirm User</i>).
          <br />
          2. Baris profil akan dibuat otomatis oleh sistem dengan status nonaktif.
          <br />
          3. Cari nama/email pengguna di tabel di bawah, lalu klik <b>Ubah</b> untuk melengkapi nama, menentukan peran, dan mengaktifkan akun.
        </p>
      </div>

      <form className="flex max-w-md gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Cari nama atau email" aria-label="Cari pengguna" />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Cari
        </Button>
      </form>

      <Card className="py-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead className="text-center">Status Akun</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead className="pr-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-danger">
                  Data pengguna gagal dimuat. Muat ulang halaman ini.
                </TableCell>
              </TableRow>
            )}
            {!error && pengguna?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {cari ? `Tidak ada pengguna yang cocok dengan "${cari}".` : "Belum ada data pengguna."}
                </TableCell>
              </TableRow>
            )}
            {pengguna?.map((u) => {
              const peranLabel = LABEL_PERAN[u.role as keyof typeof LABEL_PERAN] || u.role;
              const isOwner = u.role === "owner";
              const isAdmin = u.role === "admin";

              let badgePeran = <Badge variant="secondary">{peranLabel}</Badge>;
              if (isOwner) {
                badgePeran = <Badge className="bg-primary text-white">{peranLabel}</Badge>;
              } else if (isAdmin) {
                badgePeran = <Badge variant="outline" className="border-primary text-primary">{peranLabel}</Badge>;
              }

              const userProp: ProfilPengguna = {
                id: u.id,
                nama: u.nama,
                email: u.email,
                role: u.role as "owner" | "admin" | "kepala_mekanik",
                aktif: u.aktif,
                created_at: u.created_at,
              };

              return (
                <TableRow key={u.id}>
                  <TableCell className="pl-4 font-medium text-text">{u.nama}</TableCell>
                  <TableCell className="text-sm font-mono text-text-muted">{u.email}</TableCell>
                  <TableCell>{badgePeran}</TableCell>
                  <TableCell className="text-center">
                    {u.aktif ? (
                      <Badge className="bg-success text-white">Aktif</Badge>
                    ) : (
                      <Badge variant="outline" className="text-text-muted">
                        Nonaktif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-text-muted whitespace-nowrap">
                    {tanggal(u.created_at)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <FormPengguna user={userProp} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Paginasi
        halaman={halaman}
        totalBaris={count || 0}
        perHalaman={PER_HALAMAN}
        params={{ q }}
      />
    </div>
  );
}
