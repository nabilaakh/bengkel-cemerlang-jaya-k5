import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Endpoint Webhook Mayar
 * Menerima pemberitahuan pembayaran dari Mayar V2, memverifikasi ulang ke server Mayar (Zero-Trust),
 * dan menandai invoice lunas dengan Supabase Secret Key.
 */
export async function POST(request: NextRequest) {
  // Inisialisasi klien Supabase Admin khusus di route handler ini
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error("Konfigurasi SUPABASE_SECRET_KEY atau SUPABASE_URL belum diatur.");
    return NextResponse.json({ received: true, error: "Konfigurasi server belum lengkap." }, { status: 200 });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let logId: number | null = null;
  let candidateMayarId: string | null = null;
  let eventName = "unknown";

  try {
    // 1. Baca payload JSON dari webhook
    const rawPayload = await request.json().catch(() => null);

    if (!rawPayload || typeof rawPayload !== "object") {
      await supabaseAdmin.from("mayar_webhook_log").insert({
        event: "invalid_payload",
        mayar_invoice_id: null,
        payload: { error: "Payload webhook bukan JSON yang valid" },
        status_proses: "ditolak",
        pesan_error: "Format payload tidak valid atau kosong",
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    eventName =
      rawPayload.event ||
      rawPayload["event.received"] ||
      (rawPayload.data ? "payment.received" : "unknown");

    // Ambil kemungkinan ID Mayar dari payload
    candidateMayarId =
      rawPayload.data?.productId ||
      rawPayload.data?.paymentLinkId ||
      rawPayload.data?.id ||
      null;

    // Catat setiap pesan masuk ke mayar_webhook_log
    const { data: logEntry } = await supabaseAdmin
      .from("mayar_webhook_log")
      .insert({
        event: eventName,
        mayar_invoice_id: candidateMayarId,
        payload: rawPayload,
        status_proses: "memproses",
      })
      .select("id")
      .single();

    if (logEntry) {
      logId = logEntry.id;
    }

    // 2. Jangan percaya isi pesan. Tanya ulang detail transaksi langsung ke Mayar V2
    const apiKey = process.env.MAYAR_API_KEY?.trim();
    const rawBaseUrl = process.env.MAYAR_BASE_URL?.trim() || "https://api.mayar.io/hl/v2";

    if (!apiKey) {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: "MAYAR_API_KEY belum dikonfigurasi di server",
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Cari invoice di database kita untuk memastikan mayar_invoice_id
    let invoiceRecord = null;
    if (candidateMayarId) {
      const { data } = await supabaseAdmin
        .from("invoices")
        .select("id, nomor, total, terbayar, status_bayar, mayar_invoice_id, mayar_jumlah")
        .eq("mayar_invoice_id", candidateMayarId)
        .maybeSingle();
      if (data) invoiceRecord = data;
    }

    // Jika belum ketemu dari candidateMayarId, periksa extraData.invoiceId
    const extraInvoiceId = rawPayload.data?.extraData?.invoiceId;
    if (!invoiceRecord && extraInvoiceId && typeof extraInvoiceId === "string") {
      const { data } = await supabaseAdmin
        .from("invoices")
        .select("id, nomor, total, terbayar, status_bayar, mayar_invoice_id, mayar_jumlah")
        .eq("id", extraInvoiceId)
        .maybeSingle();
      if (data) {
        invoiceRecord = data;
        if (data.mayar_invoice_id) {
          candidateMayarId = data.mayar_invoice_id;
        }
      }
    }

    if (!candidateMayarId) {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: "ID Invoice Mayar tidak ditemukan dalam payload",
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Normalisasi URL endpoint Mayar V2 (/hl/v2/invoices/{id})
    let cleanBaseUrl = rawBaseUrl.replace(/\/+$/, "");
    if (!cleanBaseUrl.includes("/hl/v2")) {
      cleanBaseUrl = `${cleanBaseUrl}/hl/v2`;
    }
    const mayarDetailUrl = `${cleanBaseUrl}/invoices/${candidateMayarId}`;

    // Batas waktu tunggu tanya detail ke Mayar maksimal 7 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    let mayarDetailRes: Response;
    try {
      mayarDetailRes = await fetch(mayarDetailUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      const pesan =
        fetchErr instanceof Error && fetchErr.name === "AbortError"
          ? "Batas waktu verifikasi ke Mayar terlampaui"
          : "Gagal menghubungi API Mayar";

      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: pesan,
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!mayarDetailRes.ok) {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: `API Mayar mengembalikan status error ${mayarDetailRes.status} saat konfirmasi invoice`,
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const mayarDetail = await mayarDetailRes.json().catch(() => null);
    const verifiedData = mayarDetail?.data;

    if (!verifiedData) {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: "Respon verifikasi Mayar tidak memuat data detail",
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // 3. Verifikasi kriteria:
    // a. Status di Mayar harus sudah "paid"
    if (verifiedData.status !== "paid") {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: `Status invoice di Mayar bukan paid (status saat ini: ${verifiedData.status})`,
            mayar_invoice_id: candidateMayarId,
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // b. Pastikan invoice ada di database kita
    if (!invoiceRecord) {
      const { data } = await supabaseAdmin
        .from("invoices")
        .select("id, nomor, total, terbayar, status_bayar, mayar_invoice_id, mayar_jumlah")
        .eq("mayar_invoice_id", verifiedData.id)
        .maybeSingle();
      if (data) invoiceRecord = data;
    }

    if (!invoiceRecord) {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: `Invoice dengan Mayar ID ${verifiedData.id} tidak ditemukan di database invoices bengkel`,
            mayar_invoice_id: verifiedData.id,
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // c. Pastikan jumlah dari verifikasi Mayar sama dengan mayar_jumlah di invoice kita
    const nominalTerverifikasi = Number(verifiedData.amount);
    const nominalTercatat = Number(invoiceRecord.mayar_jumlah);

    if (nominalTerverifikasi !== nominalTercatat) {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "ditolak",
            pesan_error: `Jumlah tagihan Mayar (${nominalTerverifikasi}) tidak cocok dengan mayar_jumlah di database (${nominalTercatat})`,
            mayar_invoice_id: verifiedData.id,
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // 4. Semua validasi lolos: Panggil fungsi tandai_lunas_mayar via Secret Key
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "tandai_lunas_mayar",
      {
        p_mayar_invoice_id: verifiedData.id,
      }
    );

    if (rpcError) {
      if (logId) {
        await supabaseAdmin
          .from("mayar_webhook_log")
          .update({
            status_proses: "gagal",
            pesan_error: `Gagal menjalankan tandai_lunas_mayar: ${rpcError.message}`,
            mayar_invoice_id: verifiedData.id,
          })
          .eq("id", logId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // 5. Catat hasil pemeriksaan diterima di log
    if (logId) {
      await supabaseAdmin
        .from("mayar_webhook_log")
        .update({
          status_proses: "diterima",
          pesan_error: null,
          mayar_invoice_id: verifiedData.id,
        })
        .eq("id", logId);
    }

    return NextResponse.json(
      {
        received: true,
        status: "diterima",
        detail: rpcResult,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("Kesalahan internal webhook Mayar:", err instanceof Error ? err.message : "Error");
    if (logId) {
      await supabaseAdmin
        .from("mayar_webhook_log")
        .update({
          status_proses: "gagal",
          pesan_error: err instanceof Error ? err.message : "Kesalahan sistem internal",
        })
        .eq("id", logId);
    }
    // Selalu balas 200 ke webhook agar tidak terjadi infinite retry loop dari penyedia
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
