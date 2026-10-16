"use client";

import Link from "next/link";
import { Printer, ChevronLeft, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupiah, tanggal } from "@/lib/format";

interface KomponenInvoiceProps {
  workOrder: {
    id: string;
    nomor: string;
    plat: string;
    merek_model: string;
    tahun: number | null;
    warna: string | null;
    transmisi: string | null;
    keluhan: string;
    customer_nama: string;
    customer_telepon: string;
    customer_alamat: string | null;
  };
  invoice: {
    id: string;
    nomor: string;
    subtotal: number;
    diskon: number;
    total: number;
    terbayar: number;
    status_bayar: "belum_bayar" | "sebagian" | "lunas";
    diterbitkan_at: string;
  };
  items: Array<{
    id: string;
    nama_item: string;
    jenis: string;
    jumlah: number;
    harga_dipakai: number;
  }>;
  payments: Array<{
    id: string;
    metode: string;
    jumlah: number;
    created_at: string;
    dicatat_oleh_nama: string | null;
  }>;
  bengkel: {
    nama: string;
    alamat: string;
    telepon: string;
    jam_buka: string | null;
    logo_url: string | null;
  };
}

export function KomponenInvoice({
  workOrder,
  invoice,
  items,
  payments,
  bengkel,
}: KomponenInvoiceProps) {
  const sisa = Math.max(0, invoice.total - invoice.terbayar);

  return (
    <div className="space-y-6">
      {/* Tombol Aksi Layar (Disembunyikan saat dicetak) */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" asChild className="text-xs">
          <Link href={`/work-orders/${workOrder.id}/tagihan`}>
            <ChevronLeft className="mr-1 size-3.5" />
            Kembali ke Tagihan
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-primary text-white hover:bg-primary/90 text-xs shadow-sm"
          >
            <Printer className="mr-1.5 size-3.5" />
            Cetak / Simpan PDF (A4)
          </Button>
        </div>
      </div>

      {/* Lembar Invoice A4 Siap Cetak */}
      <div className="mx-auto max-w-4xl bg-white text-black p-8 md:p-12 rounded-xl border border-border shadow-sm print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:m-0">
        {/* Header Invoice */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <div className="flex items-center gap-4">
            {bengkel.logo_url ? (
              <img
                src={bengkel.logo_url}
                alt={bengkel.nama}
                className="h-16 w-auto object-contain max-w-[180px]"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-primary">
                <Wrench className="size-7 text-blue-600" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">
                {bengkel.nama}
              </h1>
              <p className="text-xs text-gray-600 max-w-sm mt-0.5">
                {bengkel.alamat}
              </p>
              <p className="text-xs text-gray-600">
                Telp: {bengkel.telepon}
                {bengkel.jam_buka && ` · ${bengkel.jam_buka}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black tracking-wider text-blue-700">
              INVOICE
            </span>
            <div className="mt-1 text-xs font-mono font-bold text-gray-800">
              {invoice.nomor}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Tanggal: {tanggal(invoice.diterbitkan_at)}
            </div>
            <div className="mt-2">
              <span
                className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase border ${
                  invoice.status_bayar === "lunas"
                    ? "bg-green-50 text-green-700 border-green-300"
                    : invoice.status_bayar === "sebagian"
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-red-50 text-red-700 border-red-300"
                }`}
              >
                {invoice.status_bayar === "lunas"
                  ? "LUNAS"
                  : invoice.status_bayar === "sebagian"
                  ? "DIBAYAR SEBAGIAN"
                  : "BELUM DIBAYAR"}
              </span>
            </div>
          </div>
        </div>

        {/* Informasi Pelanggan & Kendaraan */}
        <div className="grid grid-cols-2 gap-8 py-6 border-b border-gray-200 text-xs">
          <div>
            <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
              Ditagihkan Kepada:
            </span>
            <div className="font-semibold text-gray-900 text-sm mt-1">
              {workOrder.customer_nama}
            </div>
            <div className="text-gray-600 mt-0.5">
              Telepon: {workOrder.customer_telepon}
            </div>
            {workOrder.customer_alamat && (
              <div className="text-gray-600 mt-0.5">
                Alamat: {workOrder.customer_alamat}
              </div>
            )}
          </div>

          <div>
            <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
              Informasi Kendaraan & Layanan:
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-300 text-xs">
                {workOrder.plat}
              </span>
              <span className="font-medium text-gray-800">
                {workOrder.merek_model} {workOrder.tahun ? `(${workOrder.tahun})` : ""}
              </span>
            </div>
            <div className="text-gray-600 mt-1">
              Transmisi: {workOrder.transmisi || "-"} · Warna: {workOrder.warna || "-"}
            </div>
            <div className="text-gray-600 mt-0.5">
              Nomor WO: <span className="font-mono">{workOrder.nomor}</span>
            </div>
          </div>
        </div>

        {/* Tabel Baris Item Sesuai PRD 6.9 (Tanpa Modal, Tanpa Penyesuaian, Tanpa Harga Master) */}
        <div className="py-6">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b-2 border-gray-300 text-gray-700 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 w-10 text-center">No</th>
                <th className="py-2.5">Deskripsi Layanan / Spare Part</th>
                <th className="py-2.5 w-20 text-center">Jenis</th>
                <th className="py-2.5 w-16 text-right">Qty</th>
                <th className="py-2.5 w-28 text-right">Harga</th>
                <th className="py-2.5 w-32 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td className="py-3 text-center text-gray-500 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3 font-medium text-gray-900">
                    {it.nama_item}
                  </td>
                  <td className="py-3 text-center uppercase text-[10px] text-gray-500">
                    {it.jenis}
                  </td>
                  <td className="py-3 text-right font-mono text-gray-800">
                    {it.jumlah}
                  </td>
                  <td className="py-3 text-right font-mono text-gray-800">
                    {rupiah(it.harga_dipakai)}
                  </td>
                  <td className="py-3 text-right font-mono font-medium text-gray-900">
                    {rupiah(it.jumlah * it.harga_dipakai)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ringkasan Biaya Total */}
        <div className="border-t-2 border-gray-300 pt-4 flex justify-end">
          <div className="w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-mono">{rupiah(invoice.subtotal)}</span>
            </div>

            {invoice.diskon > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Diskon:</span>
                <span className="font-mono">-{rupiah(invoice.diskon)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-gray-300 pt-2 text-sm font-bold text-gray-900">
              <span>Total Tagihan:</span>
              <span className="font-mono text-blue-700">
                {rupiah(invoice.total)}
              </span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Sudah Dibayar:</span>
              <span className="font-mono text-green-700 font-medium">
                {rupiah(invoice.terbayar)}
              </span>
            </div>

            <div className="flex justify-between border-t border-gray-300 pt-1.5 font-bold text-xs text-gray-900">
              <span>Sisa Tagihan:</span>
              <span className={`font-mono ${sisa > 0 ? "text-red-600" : "text-gray-900"}`}>
                {rupiah(sisa)}
              </span>
            </div>
          </div>
        </div>

        {/* Riwayat Pembayaran (Bila Ada) */}
        {payments.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-4 text-xs">
            <span className="font-bold text-gray-600 uppercase tracking-wider text-[10px]">
              Rincian Riwayat Pembayaran:
            </span>
            <table className="w-full mt-2 text-[11px] text-gray-600">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-left">
                  <th className="py-1">Tanggal</th>
                  <th className="py-1">Metode</th>
                  <th className="py-1 text-right">Jumlah</th>
                  <th className="py-1 text-right">Pencatat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1">{tanggal(p.created_at)}</td>
                    <td className="py-1 uppercase">{p.metode}</td>
                    <td className="py-1 text-right text-green-700 font-medium">
                      {rupiah(p.jumlah)}
                    </td>
                    <td className="py-1 text-right font-sans text-gray-500">
                      {p.dicatat_oleh_nama || "Petugas"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tanda Tangan */}
        <div className="mt-16 pt-8 border-t border-gray-200 grid grid-cols-2 gap-12 text-center text-xs">
          <div>
            <p className="text-gray-500">Penerima / Pemilik Kendaraan,</p>
            <div className="h-20" />
            <p className="font-bold text-gray-900 border-t border-gray-400 pt-1 inline-block min-w-44">
              ( {workOrder.customer_nama} )
            </p>
          </div>

          <div>
            <p className="text-gray-500">Kasir / Administrasi Bengkel,</p>
            <div className="h-20" />
            <p className="font-bold text-gray-900 border-t border-gray-400 pt-1 inline-block min-w-44">
              ( {bengkel.nama} )
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
