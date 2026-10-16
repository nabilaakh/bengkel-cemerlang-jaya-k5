"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rupiah, rupiahRingkas } from "@/lib/format";
import { TrendingUp, Calendar } from "lucide-react";

export interface TitikTrenKeuangan {
  tanggal: string; // YYYY-MM-DD
  pendapatan_jasa: number;
  pendapatan_part: number;
  laba?: number;
}

export interface TitikTrenKuantitas {
  tanggal: string; // YYYY-MM-DD
  jumlah: number;
}

interface GrafikTrenHarianProps {
  judul: string;
  keterangan: string;
  tipe: "keuangan" | "wo_selesai";
  dataKeuangan?: TitikTrenKeuangan[];
  dataKuantitas?: TitikTrenKuantitas[];
  tautanSumber?: string;
  tampilkanLaba?: boolean;
}

export function GrafikTrenHarian({
  judul,
  keterangan,
  tipe,
  dataKeuangan = [],
  dataKuantitas = [],
  tautanSumber,
  tampilkanLaba = false,
}: GrafikTrenHarianProps) {
  const router = useRouter();

  // Format tanggal singkat untuk sumbu X (misal "15 Okt")
  const formatSumbuTanggal = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    const namaBulan = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];
    const idx = parseInt(m, 10) - 1;
    return `${parseInt(d, 10)} ${namaBulan[idx] || ""}`;
  };

  // Cek apakah ada data bernilai > 0
  const adaData = React.useMemo(() => {
    if (tipe === "keuangan") {
      return dataKeuangan.some(
        (d) => (d.pendapatan_jasa || 0) > 0 || (d.pendapatan_part || 0) > 0 || (d.laba || 0) > 0
      );
    }
    return dataKuantitas.some((d) => (d.jumlah || 0) > 0);
  }, [tipe, dataKeuangan, dataKuantitas]);

  const handleKlikGrafik = () => {
    if (tautanSumber) {
      router.push(tautanSumber);
    }
  };

  return (
    <Card className="flex flex-col border-border bg-card">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
        </div>
        {tautanSumber && (
          <button
            type="button"
            onClick={handleKlikGrafik}
            className="text-xs font-medium text-primary hover:underline"
          >
            Buka Sumber &rarr;
          </button>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between pt-2">
        {!adaData ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Calendar className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-text">Belum ada transaksi di periode ini</p>
            <p className="mt-1 text-xs text-text-muted">
              {tipe === "keuangan"
                ? "Pendapatan harian akan otomatis tercatat saat ada invoice yang diterbitkan."
                : "Aktivitas pengerjaan mobil akan tampil di grafik ini saat mobil selesai dikerjakan."}
            </p>
          </div>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {tipe === "keuangan" ? (
                <AreaChart
                  data={dataKeuangan}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  onClick={handleKlikGrafik}
                  className="cursor-pointer"
                >
                  <defs>
                    {/* Gradien Jasa */}
                    <linearGradient id="colorJasa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2196F3" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2196F3" stopOpacity={0.0} />
                    </linearGradient>
                    {/* Gradien Spare Part */}
                    <linearGradient id="colorPart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7E57C2" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7E57C2" stopOpacity={0.0} />
                    </linearGradient>
                    {/* Gradien Laba */}
                    <linearGradient id="colorLaba" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2E7D32" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF2FA" />
                  <XAxis
                    dataKey="tanggal"
                    tickFormatter={formatSumbuTanggal}
                    tick={{ fill: "#757575", fontSize: 11 }}
                    axisLine={{ stroke: "#EAF2FA" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => (val === 0 ? "0" : rupiahRingkas(val))}
                    tick={{ fill: "#757575", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as TitikTrenKeuangan;
                        const totalHariIni =
                          (item.pendapatan_jasa || 0) + (item.pendapatan_part || 0);
                        return (
                          <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-lg">
                            <p className="font-semibold text-text">
                              {formatSumbuTanggal(String(label))}
                            </p>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-text-muted">
                                  <span className="size-2 rounded-full bg-[#2196F3]" />
                                  Jasa:
                                </span>
                                <span className="font-semibold text-text tabular-nums">
                                  {rupiah(item.pendapatan_jasa || 0)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-text-muted">
                                  <span className="size-2 rounded-full bg-[#7E57C2]" />
                                  Spare Part:
                                </span>
                                <span className="font-semibold text-text tabular-nums">
                                  {rupiah(item.pendapatan_part || 0)}
                                </span>
                              </div>
                              <div className="border-t border-border pt-1 flex items-center justify-between gap-4">
                                <span className="font-medium text-text">Total Pendapatan:</span>
                                <span className="font-bold text-text tabular-nums">
                                  {rupiah(totalHariIni)}
                                </span>
                              </div>
                              {tampilkanLaba && item.laba !== undefined && (
                                <div className="flex items-center justify-between gap-4 text-success">
                                  <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-[#2E7D32]" />
                                    Laba Kotor:
                                  </span>
                                  <span className="font-bold tabular-nums">
                                    {rupiah(item.laba)}
                                  </span>
                                </div>
                              )}
                            </div>
                            {tautanSumber && (
                              <p className="mt-2 border-t border-border/70 pt-1 text-[10px] text-primary">
                                Klik untuk melihat rincian
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pendapatan_jasa"
                    name="Jasa"
                    stroke="#2196F3"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorJasa)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="pendapatan_part"
                    name="Spare Part"
                    stroke="#7E57C2"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPart)"
                    stackId="1"
                  />
                  {tampilkanLaba && (
                    <Area
                      type="monotone"
                      dataKey="laba"
                      name="Laba Kotor"
                      stroke="#2E7D32"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#colorLaba)"
                    />
                  )}
                </AreaChart>
              ) : (
                <AreaChart
                  data={dataKuantitas}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={handleKlikGrafik}
                  className="cursor-pointer"
                >
                  <defs>
                    <linearGradient id="colorWO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4CAF50" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF2FA" />
                  <XAxis
                    dataKey="tanggal"
                    tickFormatter={formatSumbuTanggal}
                    tick={{ fill: "#757575", fontSize: 11 }}
                    axisLine={{ stroke: "#EAF2FA" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#757575", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const val = payload[0].value;
                        return (
                          <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-lg">
                            <p className="font-semibold text-text">
                              {formatSumbuTanggal(String(label))}
                            </p>
                            <p className="mt-1 font-bold text-success tabular-nums">
                              {String(val)} WO Selesai
                            </p>
                            {tautanSumber && (
                              <p className="mt-1 text-[10px] text-primary">
                                Klik untuk melihat daftar WO
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="jumlah"
                    stroke="#4CAF50"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorWO)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Legenda Bawah */}
        {adaData && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted">
            {tipe === "keuangan" ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#2196F3]" />
                  <span>Jasa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#7E57C2]" />
                  <span>Spare Part</span>
                </div>
                {tampilkanLaba && (
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#2E7D32]" />
                    <span className="text-success font-medium">Laba Kotor</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-success">
                <span className="size-2.5 rounded-full bg-[#4CAF50]" />
                <span className="font-medium">Work Order Selesai</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
