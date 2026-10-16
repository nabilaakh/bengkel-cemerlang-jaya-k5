"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export interface BebanMekanikItem {
  mekanik: string;
  tim: string;
  wo_aktif: number;
  wo_selesai: number;
}

export function GrafikBebanMekanik({
  data = [],
  judul = "Beban Pengerjaan Mekanik",
  keterangan = "Perbandingan WO aktif dan WO selesai periode ini per mekanik",
}: {
  data?: BebanMekanikItem[];
  judul?: string;
  keterangan?: string;
}) {
  const router = useRouter();

  const adaData = React.useMemo(() => {
    return data.length > 0 && data.some((d) => (d.wo_aktif || 0) > 0 || (d.wo_selesai || 0) > 0);
  }, [data]);

  function handleKlik() {
    router.push("/tim-mekanik");
  }

  return (
    <Card className="flex flex-col border-border bg-card">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
        </div>
        <button
          type="button"
          onClick={handleKlik}
          className="text-xs font-medium text-primary hover:underline"
        >
          Tim Mekanik &rarr;
        </button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between pt-2">
        {!adaData ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Users className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-text">Belum ada aktivitas mekanik</p>
            <p className="mt-1 text-xs text-text-muted">
              Data pengerjaan mobil akan muncul setelah mekanik ditugaskan pada Work Order.
            </p>
          </div>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={handleKlik}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF2FA" />
                <XAxis
                  dataKey="mekanik"
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
                      const item = payload[0].payload as BebanMekanikItem;
                      return (
                        <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-lg">
                          <p className="font-semibold text-text">{String(label)}</p>
                          <p className="text-[11px] text-text-muted">{item.tim}</p>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-text-muted">
                                <span className="size-2 rounded-full bg-[#2196F3]" />
                                WO Aktif:
                              </span>
                              <span className="font-bold text-text tabular-nums">
                                {item.wo_aktif}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-text-muted">
                                <span className="size-2 rounded-full bg-[#4CAF50]" />
                                WO Selesai:
                              </span>
                              <span className="font-bold text-success tabular-nums">
                                {item.wo_selesai}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 border-t border-border/70 pt-1 text-[10px] text-primary">
                            Klik untuk membuka data Tim Mekanik
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="wo_aktif"
                  name="WO Aktif"
                  fill="#2196F3"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="wo_selesai"
                  name="WO Selesai"
                  fill="#4CAF50"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legenda Bawah */}
        {adaData && (
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#2196F3]" />
              <span>WO Aktif (Dikerjakan / Tertunda)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#4CAF50]" />
              <span>WO Selesai Periode Ini</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
