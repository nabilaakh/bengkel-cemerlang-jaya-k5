import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ambilProfilSaya } from "@/lib/profil";
import { createClient } from "@/lib/supabase/server";
import { KomponenInvoice } from "./KomponenInvoice";

export default async function InvoiceWorkOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profil = await ambilProfilSaya();
  const supabase = await createClient();

  // PRD 4: Invoice hanya dapat dibuka oleh Admin dan Owner
  if (profil.peran === "kepala_mekanik") {
    redirect(`/work-orders/${id}/tagihan`);
  }

  // Ambil detail work order, invoice, pembayaran, dan setelan bengkel
  const { data: wo, error } = await supabase
    .from("work_orders")
    .select(`
      id, nomor, status, keluhan,
      vehicles (plat, merek_model, tahun, warna, transmisi),
      customers (nama, telepon, alamat),
      billing_items (id, nama_item, jenis, jumlah, harga_dipakai),
      invoices (
        id, nomor, subtotal, diskon, total, terbayar, status_bayar, diterbitkan_at, mayar_link, dibayar_online_at,
        payments (
          id, metode, jumlah, created_at,
          profiles!payments_dicatat_oleh_fkey (nama)
        )
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !wo) {
    notFound();
  }

  // Ambil setelan bengkel (logo, alamat, kontak)
  const { data: bengkelData } = await supabase
    .from("workshop_settings")
    .select("nama, alamat, telepon, jam_buka, logo_path")
    .eq("id", 1)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (bengkelData?.logo_path) {
    const { data: urlData } = supabase.storage
      .from("publik")
      .getPublicUrl(bengkelData.logo_path);
    logoUrl = urlData.publicUrl;
  }

  const rawInvoice = wo.invoices as unknown as
    | {
        id: string;
        nomor: string;
        subtotal: number;
        diskon: number;
        total: number;
        terbayar: number;
        status_bayar: "belum_bayar" | "sebagian" | "lunas";
        diterbitkan_at: string;
        mayar_link?: string | null;
        dibayar_online_at?: string | null;
        payments: Array<{
          id: string;
          metode: string;
          jumlah: number;
          created_at: string;
          profiles: { nama: string } | null;
        }>;
      }
    | null;

  // Jika invoice belum terbit, tampilkan pemberitahuan ramah
  if (!rawInvoice || !rawInvoice.id) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" asChild className="text-xs">
          <Link href={`/work-orders/${wo.id}/tagihan`}>
            <ChevronLeft className="mr-1 size-3.5" />
            Kembali ke Tagihan
          </Link>
        </Button>

        <Card className="border-border bg-card shadow-card max-w-xl mx-auto mt-12 text-center p-6">
          <CardHeader className="pb-3 flex flex-col items-center">
            <div className="p-3 bg-amber-500/10 rounded-full text-amber-600 mb-2">
              <Receipt className="size-8" />
            </div>
            <CardTitle className="text-base font-semibold text-text">
              Invoice Belum Diterbitkan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-text-muted">
            <p>
              Work Order <strong>{wo.nomor}</strong> belum memiliki invoice resmi.
              Invoice dapat diterbitkan oleh Admin atau Owner setelah status WO
              mencapai <strong>Siap Diambil</strong>.
            </p>
            <div className="pt-2">
              <Button asChild size="sm" className="bg-primary text-white hover:bg-primary/90 text-xs">
                <Link href={`/work-orders/${wo.id}/tagihan`}>
                  Buka Halaman Tagihan
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const vehicleObj = wo.vehicles as {
    plat: string;
    merek_model: string;
    tahun: number | null;
    warna: string | null;
    transmisi: string | null;
  } | null;

  const customerObj = wo.customers as {
    nama: string;
    telepon: string;
    alamat: string | null;
  } | null;

  return (
    <KomponenInvoice
      peran={profil.peran}
      workOrder={{
        id: wo.id,
        nomor: wo.nomor,
        plat: vehicleObj?.plat || "-",
        merek_model: vehicleObj?.merek_model || "-",
        tahun: vehicleObj?.tahun || null,
        warna: vehicleObj?.warna || null,
        transmisi: vehicleObj?.transmisi || null,
        keluhan: wo.keluhan,
        customer_nama: customerObj?.nama || "-",
        customer_telepon: customerObj?.telepon || "-",
        customer_alamat: customerObj?.alamat || null,
      }}
      invoice={{
        id: rawInvoice.id,
        nomor: rawInvoice.nomor,
        subtotal: rawInvoice.subtotal,
        diskon: rawInvoice.diskon,
        total: rawInvoice.total,
        terbayar: rawInvoice.terbayar,
        status_bayar: rawInvoice.status_bayar,
        diterbitkan_at: rawInvoice.diterbitkan_at,
        mayar_link: rawInvoice.mayar_link || null,
        dibayar_online_at: rawInvoice.dibayar_online_at || null,
      }}
      items={(wo.billing_items || []).map((it) => ({
        id: it.id,
        nama_item: it.nama_item,
        jenis: it.jenis,
        jumlah: it.jumlah,
        harga_dipakai: it.harga_dipakai,
      }))}
      payments={(rawInvoice.payments || []).map((p) => ({
        id: p.id,
        metode: p.metode,
        jumlah: p.jumlah,
        created_at: p.created_at,
        dicatat_oleh_nama: p.profiles?.nama || null,
      }))}
      bengkel={{
        nama: bengkelData?.nama || "Cemerlang Jaya Motor",
        alamat:
          bengkelData?.alamat || "Jl. Raya Cibubur No. 88, Jakarta Timur",
        telepon: bengkelData?.telepon || "021-8770 1234",
        jam_buka: bengkelData?.jam_buka || "Senin - Sabtu, 08:00 - 17:00",
        logo_url: logoUrl,
      }}
    />
  );
}
