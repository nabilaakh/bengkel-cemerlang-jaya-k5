"use client";

import { useState, useEffect } from "react";
import { Check, Copy, Globe, ShieldCheck, AlertCircle, Radio } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tanggal } from "@/lib/format";

interface WebhookLogItem {
  id: number;
  event: string | null;
  mayar_invoice_id: string | null;
  status_proses: string;
  pesan_error: string | null;
  created_at: string;
}

interface PaymentGatewaySettingsProps {
  terhubung: boolean;
  modeSandbox: boolean;
  logs: WebhookLogItem[];
}

export function PaymentGatewaySettings({
  terhubung,
  modeSandbox,
  logs,
}: PaymentGatewaySettingsProps) {
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    // Bangun URL lengkap di sisi klien
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhook/mayar`);
    }
  }, []);

  const handleSalin = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success("URL Webhook berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin URL.");
    }
  };

  return (
    <Card className="border-border bg-card shadow-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-text">
                Payment Gateway (Mayar)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono uppercase">
                Khusus Owner
              </Badge>
            </div>
            <CardDescription className="text-xs text-text-muted">
              Status integrasi pembayaran online dan log webhook real-time dari Mayar.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {terhubung ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Terhubung
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-medium gap-1">
                <span className="size-1.5 rounded-full bg-red-500" />
                Belum Terhubung
              </Badge>
            )}

            <Badge
              variant="outline"
              className={`text-xs font-medium ${
                modeSandbox
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300"
              }`}
            >
              <Radio className="size-3 mr-1" />
              {modeSandbox ? "Sandbox (Uji Coba)" : "Production (Live)"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        {/* Ringkasan Konfigurasi Server */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg border border-border bg-muted/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text">
              <ShieldCheck className="size-3.5 text-primary" />
              Kunci API Server (MAYAR_API_KEY)
            </div>
            <p className="text-[11px] text-text-muted">
              {terhubung
                ? "Tersedia dan aktif di server (.env.local). Nilai dirahasiakan."
                : "Belum dikonfigurasi. Tambahkan MAYAR_API_KEY di file .env.local."}
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-muted/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text">
              <Globe className="size-3.5 text-primary" />
              Environment Endpoint
            </div>
            <p className="text-[11px] text-text-muted">
              {modeSandbox
                ? "Mode Sandbox aktif (api.mayar.io/hl/v2). Transaksi tidak menggunakan saldo asli."
                : "Mode Production aktif. Transaksi akan memotong saldo sungguhan."}
            </p>
          </div>
        </div>

        {/* Input URL Webhook yang Bisa Disalin */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text flex items-center justify-between">
            <span>URL Webhook Mayar</span>
            <span className="text-[11px] text-text-muted">
              Daftarkan URL ini pada Dashboard Mayar → Integrasi → Webhook
            </span>
          </label>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={webhookUrl || "Memuat URL..."}
              className="font-mono text-xs bg-muted/50 text-text selection:bg-primary/20"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSalin}
              className="shrink-0 text-xs font-medium gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Salin URL
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 10 Baris Terakhir Log Webhook */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-text">
                10 Pesan Terakhir Webhook (mayar_webhook_log)
              </h3>
              <p className="text-[11px] text-text-muted">
                Riwayat pesan transaksi yang dikirimkan Mayar ke sistem bengkel.
              </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-6 text-center text-xs text-text-muted">
              <AlertCircle className="size-5 mx-auto mb-1.5 opacity-50" />
              Belum ada riwayat webhook yang diterima dari Mayar.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-[11px] font-semibold text-text-muted">
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Mayar Invoice ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Keterangan / Pesan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const status = log.status_proses;
                    let badgeClass = "bg-muted text-text-muted border-border";
                    if (status === "diterima" || status === "sukses") {
                      badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300";
                    } else if (status === "ditolak" || status === "gagal") {
                      badgeClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-300";
                    } else if (status === "memproses") {
                      badgeClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300";
                    }

                    return (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 text-[11px] whitespace-nowrap text-text-muted font-mono">
                          {tanggal(log.created_at)}{" "}
                          {new Date(log.created_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-text font-medium">
                          {log.event || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted max-w-[140px] truncate">
                          {log.mayar_invoice_id || "-"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-text-muted max-w-[260px] truncate">
                          {log.pesan_error || "Berhasil diproses"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
