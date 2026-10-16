import Link from "next/link";
import { Search } from "lucide-react";
import { Paginasi } from "@/components/Paginasi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rupiah, tanggal } from "@/lib/format";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { DialogSesuaikanStok } from "./DialogSesuaikanStok";
import { DialogStokMasuk } from "./DialogStokMasuk";
import { FormItem, type ItemInventory } from "./FormItem";

const PER_HALAMAN = 20;

type ItemPartTampil = {
  id: string;
  kode: string;
  nama: string;
  jenis: string;
  harga_jual: number;
  stok: number;
  stok_minimum: number;
  aktif: boolean;
  harga_modal?: number | null;
};

export default async function HalamanInventory({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; hal?: string }>;
}) {
  const { tab = "part", q = "", status = "semua", hal } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);
  const cari = q.replace(/[,()*%\\]/g, " ").trim();

  const profil = await ambilProfilSaya();
  const adalahOwner = profil.peran === "owner";
  const bolehKelola = profil.peran === "admin" || profil.peran === "owner";
  const supabase = await createClient();

  // -------------------------------------------------------------
  // TAB 1: SPARE PART
  // -------------------------------------------------------------
  if (tab === "part") {
    let itemsPart: ItemPartTampil[] = [];
    let totalHitungan = 0;
    let queryError: unknown = null;

    if (adalahOwner) {
      // Query Owner: Mengambil kolom harga_modal dari inventory_costs
      let kueri = supabase
        .from("inventory_items")
        .select("id, kode, nama, jenis, harga_jual, stok, stok_minimum, aktif, inventory_costs(harga_modal)", { count: "exact" })
        .eq("jenis", "part");

      if (cari) {
        kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
      }
      if (status === "habis") {
        kueri = kueri.eq("stok", 0);
      }

      const { data, count, error } = await kueri
        .order("nama")
        .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

      queryError = error;
      totalHitungan = count || 0;
      itemsPart = (data ?? []).map((row) => {
        const modalObj = Array.isArray(row.inventory_costs) ? row.inventory_costs[0] : row.inventory_costs;
        return {
          id: row.id,
          kode: row.kode,
          nama: row.nama,
          jenis: row.jenis,
          harga_jual: Number(row.harga_jual),
          stok: row.stok,
          stok_minimum: row.stok_minimum,
          aktif: row.aktif,
          harga_modal: modalObj?.harga_modal != null ? Number(modalObj.harga_modal) : null,
        };
      });
    } else {
      // Query Admin & Kepala Mekanik: TANPA inventory_costs (rahasia harga modal terlindungi)
      let kueri = supabase
        .from("inventory_items")
        .select("id, kode, nama, jenis, harga_jual, stok, stok_minimum, aktif", { count: "exact" })
        .eq("jenis", "part");

      if (cari) {
        kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
      }
      if (status === "habis") {
        kueri = kueri.eq("stok", 0);
      }

      const { data, count, error } = await kueri
        .order("nama")
        .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

      queryError = error;
      totalHitungan = count || 0;
      itemsPart = (data ?? []).map((row) => ({
        id: row.id,
        kode: row.kode,
        nama: row.nama,
        jenis: row.jenis,
        harga_jual: Number(row.harga_jual),
        stok: row.stok,
        stok_minimum: row.stok_minimum,
        aktif: row.aktif,
      }));
    }

    // Filter status "menipis" & "aman" pada data hasil
    let daftarTampil = itemsPart;
    if (status === "menipis") {
      daftarTampil = daftarTampil.filter((it) => it.stok > 0 && it.stok <= it.stok_minimum);
    } else if (status === "aman") {
      daftarTampil = daftarTampil.filter((it) => it.stok > it.stok_minimum);
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Inventory</h1>
            <p className="text-sm text-text-muted">Kelola spare part, jasa servis, dan mutasi stok bengkel.</p>
          </div>
          {bolehKelola && <FormItem jenis="part" peran={profil.peran} />}
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-border space-x-4">
          <Link
            href="/inventory?tab=part"
            className="border-b-2 border-primary pb-2 font-medium text-primary text-sm"
          >
            Spare Part
          </Link>
          <Link
            href="/inventory?tab=jasa"
            className="border-b-2 border-transparent pb-2 font-medium text-text-muted hover:text-text text-sm"
          >
            Jasa
          </Link>
          <Link
            href="/inventory?tab=riwayat"
            className="border-b-2 border-transparent pb-2 font-medium text-text-muted hover:text-text text-sm"
          >
            Riwayat Stok
          </Link>
        </div>

        {/* Baris Pencarian & Filter Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex max-w-md gap-2" role="search">
            <input type="hidden" name="tab" value="part" />
            {status !== "semua" && <input type="hidden" name="status" value={status} />}
            <Input name="q" defaultValue={q} placeholder="Cari nama atau kode SKU" aria-label="Cari spare part" />
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4" />
              Cari
            </Button>
          </form>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-xs text-text-muted mr-1">Status:</span>
            {[
              { id: "semua", label: "Semua" },
              { id: "habis", label: "Habis" },
              { id: "menipis", label: "Menipis" },
              { id: "aman", label: "Aman" },
            ].map((st) => (
              <Link
                key={st.id}
                href={`/inventory?tab=part&status=${st.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  status === st.id
                    ? "bg-primary text-white"
                    : "bg-muted text-text-muted hover:bg-muted/80"
                }`}
              >
                {st.label}
              </Link>
            ))}
          </div>
        </div>

        <Card className="py-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">SKU</TableHead>
                <TableHead>Nama Spare Part</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                {adalahOwner && <TableHead className="text-right">Harga Modal</TableHead>}
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="pr-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queryError ? (
                <TableRow>
                  <TableCell colSpan={adalahOwner ? 8 : 7} className="py-10 text-center text-danger">
                    Data spare part gagal dimuat. Muat ulang halaman ini.
                  </TableCell>
                </TableRow>
              ) : null}
              {!queryError && daftarTampil.length === 0 && (
                <TableRow>
                  <TableCell colSpan={adalahOwner ? 8 : 7} className="py-10 text-center text-muted-foreground">
                    {cari ? `Tidak ada spare part yang cocok dengan "${cari}".` : "Belum ada spare part."}
                  </TableCell>
                </TableRow>
              )}
              {daftarTampil.map((p) => {
                const stok = p.stok;
                const min = p.stok_minimum;
                const statusBadge =
                  stok === 0 ? (
                    <Badge variant="destructive">Habis</Badge>
                  ) : stok <= min ? (
                    <Badge className="bg-warning text-white hover:bg-warning/90">Menipis</Badge>
                  ) : (
                    <Badge className="bg-success text-white hover:bg-success/90">Aman</Badge>
                  );

                const itemProp: ItemInventory = {
                  id: p.id,
                  kode: p.kode,
                  nama: p.nama,
                  jenis: "part",
                  harga_jual: p.harga_jual,
                  stok_minimum: p.stok_minimum,
                  aktif: p.aktif,
                  harga_modal: p.harga_modal,
                };

                return (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 font-mono text-xs">{p.kode}</TableCell>
                    <TableCell className="font-medium">
                      <div>
                        {p.nama}
                        {!p.aktif && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Nonaktif
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{p.stok}</TableCell>
                    <TableCell className="text-right tabular-nums text-text-muted">{p.stok_minimum}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{rupiah(p.harga_jual)}</TableCell>
                    {adalahOwner && (
                      <TableCell className="text-right tabular-nums text-xs">
                        {p.harga_modal != null ? (
                          rupiah(p.harga_modal)
                        ) : (
                          <span className="text-warning italic font-normal">Modal belum diisi</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-center">{statusBadge}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {bolehKelola && (
                          <DialogStokMasuk
                            itemId={p.id}
                            namaItem={p.nama}
                            kodeItem={p.kode}
                            stokSaatIni={p.stok}
                          />
                        )}
                        {adalahOwner && (
                          <DialogSesuaikanStok
                            itemId={p.id}
                            namaItem={p.nama}
                            kodeItem={p.kode}
                            stokTercatat={p.stok}
                          />
                        )}
                        {adalahOwner && <FormItem jenis="part" item={itemProp} peran={profil.peran} />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <Paginasi
          halaman={halaman}
          totalBaris={totalHitungan}
          perHalaman={PER_HALAMAN}
          params={{ tab: "part", q, status: status !== "semua" ? status : undefined }}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // TAB 2: JASA SERVIS
  // -------------------------------------------------------------
  if (tab === "jasa") {
    let kueri = supabase
      .from("inventory_items")
      .select("id, kode, nama, jenis, harga_jual, aktif", { count: "exact" })
      .eq("jenis", "jasa");

    if (cari) {
      kueri = kueri.or(`nama.ilike.%${cari}%,kode.ilike.%${cari}%`);
    }

    const { data: itemsJasa, count = 0, error } = await kueri
      .order("nama")
      .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Inventory</h1>
            <p className="text-sm text-text-muted">Kelola spare part, jasa servis, dan mutasi stok bengkel.</p>
          </div>
          {bolehKelola && <FormItem jenis="jasa" peran={profil.peran} />}
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-border space-x-4">
          <Link
            href="/inventory?tab=part"
            className="border-b-2 border-transparent pb-2 font-medium text-text-muted hover:text-text text-sm"
          >
            Spare Part
          </Link>
          <Link
            href="/inventory?tab=jasa"
            className="border-b-2 border-primary pb-2 font-medium text-primary text-sm"
          >
            Jasa
          </Link>
          <Link
            href="/inventory?tab=riwayat"
            className="border-b-2 border-transparent pb-2 font-medium text-text-muted hover:text-text text-sm"
          >
            Riwayat Stok
          </Link>
        </div>

        <form className="flex max-w-md gap-2" role="search">
          <input type="hidden" name="tab" value="jasa" />
          <Input name="q" defaultValue={q} placeholder="Cari nama atau kode jasa" aria-label="Cari jasa" />
          <Button type="submit" variant="outline">
            <Search className="h-4 w-4" />
            Cari
          </Button>
        </form>

        <Card className="py-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Kode</TableHead>
                <TableHead>Nama Jasa</TableHead>
                <TableHead className="text-right">Tarif Jasa</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="pr-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-danger">
                    Data jasa servis gagal dimuat. Muat ulang halaman ini.
                  </TableCell>
                </TableRow>
              )}
              {!error && itemsJasa?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {cari ? `Tidak ada jasa yang cocok dengan "${cari}".` : "Belum ada jasa servis."}
                  </TableCell>
                </TableRow>
              )}
              {itemsJasa?.map((j) => {
                const itemProp: ItemInventory = {
                  id: j.id,
                  kode: j.kode,
                  nama: j.nama,
                  jenis: "jasa",
                  harga_jual: Number(j.harga_jual),
                  stok_minimum: 0,
                  aktif: j.aktif,
                };

                return (
                  <TableRow key={j.id}>
                    <TableCell className="pl-4 font-mono text-xs">{j.kode}</TableCell>
                    <TableCell className="font-medium">
                      <div>
                        {j.nama}
                        {!j.aktif && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Nonaktif
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {rupiah(Number(j.harga_jual))}
                    </TableCell>
                    <TableCell className="text-center">
                      {j.aktif ? (
                        <Badge className="bg-success text-white">Aktif</Badge>
                      ) : (
                        <Badge variant="outline">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {adalahOwner && <FormItem jenis="jasa" item={itemProp} peran={profil.peran} />}
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
          params={{ tab: "jasa", q }}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // TAB 3: RIWAYAT STOK (MUTASI)
  // -------------------------------------------------------------
  const { data: riwayat, count = 0, error: errRiwayat } = await supabase
    .from("stock_movements")
    .select(
      "id, created_at, jenis, jumlah, stok_sesudah, keterangan, inventory_items(id, nama, kode), work_orders(id, nomor), profiles(id, nama)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Inventory</h1>
          <p className="text-sm text-text-muted">Kelola spare part, jasa servis, dan mutasi stok bengkel.</p>
        </div>
      </div>

      {/* Tab Navigasi */}
      <div className="flex border-b border-border space-x-4">
        <Link
          href="/inventory?tab=part"
          className="border-b-2 border-transparent pb-2 font-medium text-text-muted hover:text-text text-sm"
        >
          Spare Part
        </Link>
        <Link
          href="/inventory?tab=jasa"
          className="border-b-2 border-transparent pb-2 font-medium text-text-muted hover:text-text text-sm"
        >
          Jasa
        </Link>
        <Link
          href="/inventory?tab=riwayat"
          className="border-b-2 border-primary pb-2 font-medium text-primary text-sm"
        >
          Riwayat Stok
        </Link>
      </div>

      <Card className="py-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tanggal</TableHead>
              <TableHead>Spare Part</TableHead>
              <TableHead className="text-center">Jenis Mutasi</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right">Stok Sesudah</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>No. WO</TableHead>
              <TableHead className="pr-4">Pencatat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errRiwayat && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-danger">
                  Riwayat stok gagal dimuat. Muat ulang halaman ini.
                </TableCell>
              </TableRow>
            )}
            {!errRiwayat && riwayat?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Belum ada catatan pergerakan stok.
                </TableCell>
              </TableRow>
            )}
            {riwayat?.map((r) => {
              const part = r.inventory_items as unknown as { nama: string; kode: string } | null;
              const wo = r.work_orders as unknown as { nomor: string; id: string } | null;
              const user = r.profiles as unknown as { nama: string } | null;

              let badgeMutasi = <Badge variant="outline">{r.jenis}</Badge>;
              if (r.jenis === "masuk") {
                badgeMutasi = <Badge className="bg-success text-white">Masuk</Badge>;
              } else if (r.jenis === "keluar") {
                badgeMutasi = <Badge variant="destructive">Keluar</Badge>;
              } else if (r.jenis === "penyesuaian") {
                badgeMutasi = <Badge className="bg-warning text-white">Penyesuaian</Badge>;
              } else if (r.jenis === "kembali") {
                badgeMutasi = <Badge className="bg-primary text-white">Kembali</Badge>;
              }

              return (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 text-xs whitespace-nowrap text-text-muted">
                    {tanggal(r.created_at)}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {part ? (
                      <div>
                        <span className="font-mono text-xs text-text-muted mr-1.5">{part.kode}</span>
                        {part.nama}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center">{badgeMutasi}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      r.jumlah > 0 ? "text-success" : r.jumlah < 0 ? "text-danger" : ""
                    }`}
                  >
                    {r.jumlah > 0 ? `+${r.jumlah}` : r.jumlah}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{r.stok_sesudah}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate text-text-muted">
                    {r.keterangan || "-"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {wo ? (
                      <Link href={`/work-orders/${wo.id}`} className="text-primary hover:underline">
                        {wo.nomor}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-xs text-text-muted">{user?.nama || "-"}</TableCell>
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
        params={{ tab: "riwayat" }}
      />
    </div>
  );
}
