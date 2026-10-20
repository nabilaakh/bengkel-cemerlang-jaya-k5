import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface MayarItem {
  description: string;
  quantity: number;
  rate: number;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifikasi sesi login dan peran (Hanya Admin atau Owner)
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims.sub;

    if (!userId) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau belum login. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const { data: profil, error: profilError } = await supabase
      .from("profiles")
      .select("id, nama, role, aktif")
      .eq("id", userId)
      .maybeSingle();

    if (profilError || !profil || !profil.aktif) {
      return NextResponse.json(
        { error: "Akun tidak ditemukan atau tidak aktif." },
        { status: 403 }
      );
    }

    if (profil.role !== "admin" && profil.role !== "owner") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin atau Owner yang boleh membuat tautan pembayaran." },
        { status: 403 }
      );
    }

    // 2. Terima id invoice dari body
    const body = await request.json().catch(() => ({}));
    const invoiceId = body.id || body.invoice_id;

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json(
        { error: "ID Invoice wajib disertakan." },
        { status: 400 }
      );
    }

    // Ambil data invoice dari database
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        nomor,
        subtotal,
        diskon,
        total,
        terbayar,
        status_bayar,
        mayar_invoice_id,
        mayar_link,
        mayar_jumlah,
        work_order_id
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice tidak ditemukan." },
        { status: 404 }
      );
    }

    // Hitung sisa tagihan dari database
    const total = Number(invoice.total);
    const terbayar = Number(invoice.terbayar);
    const sisaTagihan = total - terbayar;

    // Tolak jika invoice sudah lunas
    if (invoice.status_bayar === "lunas" || sisaTagihan <= 0) {
      return NextResponse.json(
        { error: "Invoice ini sudah lunas, tidak dapat membuat link pembayaran baru." },
        { status: 400 }
      );
    }

    // Ambil data work order & customer dari database
    const { data: wo, error: woError } = await supabase
      .from("work_orders")
      .select("id, nomor, customer_id")
      .eq("id", invoice.work_order_id)
      .maybeSingle();

    if (woError || !wo) {
      return NextResponse.json(
        { error: "Data Work Order terkait invoice tidak ditemukan." },
        { status: 404 }
      );
    }

    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("id, nama, telepon, email")
      .eq("id", wo.customer_id)
      .maybeSingle();

    if (custError || !customer) {
      return NextResponse.json(
        { error: "Data pelanggan terkait tidak ditemukan." },
        { status: 404 }
      );
    }

    // Tolak jika email pelanggan kosong
    if (!customer.email || customer.email.trim() === "") {
      return NextResponse.json(
        { error: "Email pelanggan kosong. Pembayaran online Mayar mewajibkan alamat email pelanggan yang valid." },
        { status: 400 }
      );
    }

    // 3. Bila invoice sudah punya mayar_link dan mayar_jumlah sama dengan sisa tagihan, kembalikan tautan itu
    if (
      invoice.mayar_link &&
      invoice.mayar_jumlah !== null &&
      Number(invoice.mayar_jumlah) === sisaTagihan
    ) {
      return NextResponse.json({
        link: invoice.mayar_link,
        mayar_invoice_id: invoice.mayar_invoice_id,
        jumlah: invoice.mayar_jumlah,
        sudah_ada: true,
      });
    }

    // 4. Bila belum ada atau jumlahnya berbeda, buat invoice di Mayar
    const apiKey = process.env.MAYAR_API_KEY?.trim();
    const rawBaseUrl = process.env.MAYAR_BASE_URL?.trim() || "https://api.mayar.io/hl/v2";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Konfigurasi server belum lengkap: Kunci API Mayar belum diatur." },
        { status: 500 }
      );
    }

    // Ambil item tagihan dari database
    const { data: billingItems } = await supabase
      .from("billing_items")
      .select("nama_item, jumlah, harga_dipakai")
      .eq("work_order_id", invoice.work_order_id);

    // Susun item untuk Mayar
    let items: MayarItem[] = [];

    if (billingItems && billingItems.length > 0) {
      items = billingItems.map((item) => ({
        description: item.nama_item,
        quantity: item.jumlah,
        rate: Number(item.harga_dipakai),
      }));

      if (Number(invoice.diskon) > 0) {
        items.push({
          description: "Diskon",
          quantity: 1,
          rate: -Number(invoice.diskon),
        });
      }

      if (terbayar > 0) {
        items.push({
          description: "Pembayaran Sebelumnya",
          quantity: 1,
          rate: -terbayar,
        });
      }
    }

    // Hitung total dari baris items
    const totalItems = items.reduce((acc, it) => acc + it.quantity * it.rate, 0);

    // Jika total items tidak cocok persis dengan sisa tagihan atau baris kosong,
    // gunakan item ringkasan agar total pembayaran di Mayar tepat sama dengan sisa tagihan
    if (items.length === 0 || totalItems !== sisaTagihan) {
      items = [
        {
          description: `Pelunasan WO ${wo.nomor} (Invoice ${invoice.nomor})`,
          quantity: 1,
          rate: sisaTagihan,
        },
      ];
    }

    // Format endpoint Mayar V2 (/hl/v2/invoices/create)
    let cleanBaseUrl = rawBaseUrl.replace(/\/+$/, "");
    if (!cleanBaseUrl.includes("/hl/v2")) {
      cleanBaseUrl = `${cleanBaseUrl}/hl/v2`;
    }
    const mayarUrl = cleanBaseUrl.endsWith("/invoices/create")
      ? cleanBaseUrl
      : `${cleanBaseUrl}/invoices/create`;

    const mayarPayload = {
      name: customer.nama,
      email: customer.email.trim(),
      mobile: customer.telepon || "081234567890",
      description: `Pembayaran Invoice ${invoice.nomor} - Cemerlang Jaya Motor`,
      items,
      extraData: {
        invoiceId: invoice.id,
        nomorInvoice: invoice.nomor,
        nomorWo: wo.nomor,
      },
    };

    // 5. Batas waktu tunggu 10 detik dengan AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let mayarRes: Response;
    try {
      mayarRes = await fetch(mayarUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mayarPayload),
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      if (
        (fetchErr instanceof Error && fetchErr.name === "AbortError") ||
        controller.signal.aborted
      ) {
        return NextResponse.json(
          { error: "Batas waktu 10 detik terlampaui saat menghubungi server pembayaran Mayar." },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: "Gagal terhubung ke layanan Mayar. Periksa koneksi internet server Anda." },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!mayarRes.ok) {
      const errJson = await mayarRes.json().catch(() => null);
      const pesanError = typeof errJson?.messages === "string" ? errJson.messages : "";
      return NextResponse.json(
        {
          error: pesanError
            ? `Penyedia pembayaran Mayar menolak pembuatan invoice: ${pesanError}`
            : "Terjadi kesalahan saat memproses permintaan di layanan Mayar.",
        },
        { status: mayarRes.status >= 400 && mayarRes.status < 500 ? mayarRes.status : 502 }
      );
    }

    const mayarData = await mayarRes.json().catch(() => null);
    const mayarInvoiceId = mayarData?.data?.id;
    const mayarLink = mayarData?.data?.link;

    if (!mayarInvoiceId || !mayarLink) {
      return NextResponse.json(
        { error: "Respon dari server Mayar tidak memuat ID atau tautan pembayaran yang valid." },
        { status: 502 }
      );
    }

    // Simpan id, tautan, dan jumlahnya lewat fungsi simpan_link_mayar
    const { error: rpcError } = await supabase.rpc("simpan_link_mayar", {
      p_invoice: invoice.id,
      p_mayar_invoice_id: mayarInvoiceId,
      p_mayar_link: mayarLink,
      p_mayar_jumlah: sisaTagihan,
    });

    if (rpcError) {
      return NextResponse.json(
        { error: `Gagal memperbarui tautan pembayaran di database: ${rpcError.message}` },
        { status: 500 }
      );
    }

    // Kembalikan tautan dan informasi pembayaran
    return NextResponse.json({
      link: mayarLink,
      mayar_invoice_id: mayarInvoiceId,
      jumlah: sisaTagihan,
    });
  } catch (err: unknown) {
    console.error("Kesalahan internal API pembayaran:", err instanceof Error ? err.message : "Error tidak diketahui");
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server saat membuat tautan pembayaran." },
      { status: 500 }
    );
  }
}
