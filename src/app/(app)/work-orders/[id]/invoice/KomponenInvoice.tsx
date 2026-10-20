"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  ChevronLeft,
  Wrench,
  CreditCard,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rupiah, tanggal } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

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
    mayar_link?: string | null;
    dibayar_online_at?: string | null;
  };
  peran?: "owner" | "admin" | "kepala_mekanik";
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
  peran,
  items,
  payments,
  bengkel,
}: KomponenInvoiceProps) {
  const router = useRouter();

  // State status pembayaran lokal untuk reaktivitas real-time
  const [statusBayar, setStatusBayar] = useState(invoice.status_bayar);
  const [terbayar, setTerbayar] = useState(invoice.terbayar);
  const [dibayarOnlineAt, setDibayarOnlineAt] = useState(invoice.dibayar_online_at || null);
  const [sedangMembuatLink, setSedangMembuatLink] = useState(false);
  const [sedangPolling, setSedangPolling] = useState(false);
  const [detikTersisa, setDetikTersisa] = useState(300);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const sisa = Math.max(0, invoice.total - terbayar);
  const bolehBayar = peran === "admin" || peran === "owner" || !peran;

  // Bersihkan timer saat unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Fungsi polling status invoice setiap 5 detik selama maksimal 5 menit (300 detik)
  const mulaiPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setSedangPolling(true);
    setDetikTersisa(300);

    // Timer countdown untuk tampilan user
    countdownRef.current = setInterval(() => {
      setDetikTersisa((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let percobaan = 0;
    const maxPercobaan = 60; // 60 kali * 5 detik = 300 detik (5 menit)

    const intervalId = setInterval(async () => {
      percobaan++;
      try {
        const supabase = createClient();
        const { data: inv, error } = await supabase
          .from("invoices")
          .select("status_bayar, terbayar, dibayar_online_at")
          .eq("id", invoice.id)
          .maybeSingle();

        if (error) {
          console.error("Gagal memeriksa status invoice:", error.message);
          return;
        }

        if (inv) {
          // Bila status berubah menjadi lunas
          if (inv.status_bayar === "lunas") {
            setStatusBayar("lunas");
            setTerbayar(inv.terbayar);
            setDibayarOnlineAt(inv.dibayar_online_at);
            setSedangPolling(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);

            toast.success("Pembayaran Berhasil Dikonfirmasi!", {
              description: "Status invoice telah diperbarui menjadi Lunas.",
            });
            router.refresh();
            return;
          }

          // Bila ada pembayaran sebagian
          if (inv.terbayar !== terbayar) {
            setTerbayar(inv.terbayar);
            setStatusBayar(inv.status_bayar as "belum_bayar" | "sebagian" | "lunas");
            router.refresh();
          }
        }

        // Jika telah mencapai batas waktu 5 menit
        if (percobaan >= maxPercobaan) {
          setSedangPolling(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          toast.info("Pemeriksaan otomatis berakhir (5 menit)", {
            description: "Silakan muat ulang halaman jika pembayaran telah diselesaikan.",
          });
        }
      } catch (err) {
        console.error("Kesalahan saat memeriksa invoice:", err);
      }
    }, 5000);

    pollingRef.current = intervalId;
  };

  // Handler klik tombol Bayar Online
  const handleBayarOnline = async () => {
    try {
      setSedangMembuatLink(true);

      const res = await fetch("/api/pembayaran/buat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat tautan pembayaran Mayar.");
      }

      if (data.link) {
        window.open(data.link, "_blank", "noopener,noreferrer");
        toast.success("Tautan pembayaran Mayar dibuka di tab baru.", {
          description: "Sistem mulai memeriksa status pembayaran setiap 5 detik.",
        });
      }

      // Mulai polling selama 5 menit
      mulaiPolling();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan saat membuat pembayaran online."
      );
    } finally {
      setSedangMembuatLink(false);
    }
  };

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
          {bolehBayar && statusBayar !== "lunas" && sisa > 0 && (
            <Button
              size="sm"
              onClick={handleBayarOnline}
              disabled={sedangMembuatLink || sedangPolling}
              className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs shadow-sm font-medium"
            >
              {sedangMembuatLink ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <CreditCard className="mr-1.5 size-3.5" />
              )}
              {sedangPolling ? "Sedang Memeriksa..." : "Bayar Online"}
              <ExternalLink className="ml-1.5 size-3 opacity-75" />
            </Button>
          )}

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

      {/* Banner Notifikasi Polling Webhook (Hanya muncul saat sedang polling) */}
      {sedangPolling && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 print:hidden animate-pulse">
          <div className="flex items-center gap-2.5">
            <Loader2 className="size-4 animate-spin text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold">Menunggu Pembayaran Online Mayar</p>
              <p className="text-[11px] text-amber-700">
                Sistem memeriksa status invoice secara berkala setiap 5 detik. Tab Mayar dapat Anda selesaikan pembayarannya.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 font-mono text-[11px] text-amber-700 font-medium">
            Sisa waktu: {Math.floor(detikTersisa / 60)}:{(detikTersisa % 60).toString().padStart(2, "0")}
          </div>
        </div>
      )}

      {/* Banner Konfirmasi Lunas Online */}
      {statusBayar === "lunas" && dibayarOnlineAt && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900 print:hidden">
          <CheckCircle2 className="size-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold">Invoice Telah Lunas Melalui Pembayaran Online</p>
            <p className="text-[11px] text-green-700">
              Dikonfirmasi lunas pada{" "}
              <strong>
                {tanggal(dibayarOnlineAt)}{" "}
                {new Date(dibayarOnlineAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                WIB
              </strong>
              .
            </p>
          </div>
        </div>
      )}

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
                  statusBayar === "lunas"
                    ? "bg-green-50 text-green-700 border-green-300"
                    : statusBayar === "sebagian"
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-red-50 text-red-700 border-red-300"
                }`}
              >
                {statusBayar === "lunas"
                  ? "LUNAS"
                  : statusBayar === "sebagian"
                  ? "DIBAYAR SEBAGIAN"
                  : "BELUM DIBAYAR"}
              </span>

              {statusBayar === "lunas" && dibayarOnlineAt && (
                <div className="text-[10px] text-green-700 mt-1 font-medium">
                  Dibayar online: {tanggal(dibayarOnlineAt)}{" "}
                  {new Date(dibayarOnlineAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  WIB
                </div>
              )}
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

        {/* Tabel Baris Item Sesuai PRD 6.9 */}
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
                {rupiah(terbayar)}
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

        {/* Riwayat Pembayaran */}
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
                    <td className="py-1 uppercase font-semibold">
                      {p.metode === "mayar" ? "ONLINE (MAYAR)" : p.metode}
                    </td>
                    <td className="py-1 text-right text-green-700 font-medium">
                      {rupiah(p.jumlah)}
                    </td>
                    <td className="py-1 text-right font-sans text-gray-500">
                      {p.dicatat_oleh_nama || "Sistem / Otomatis"}
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
