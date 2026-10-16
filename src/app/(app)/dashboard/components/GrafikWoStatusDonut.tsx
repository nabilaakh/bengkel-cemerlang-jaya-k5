"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { STATUS_WO, type StatusWO } from "@/lib/status-wo";

interface WoStatusItem {
  status: string;
  jumlah: number;
}

const WARNA_STATUS: Record<string, string> = {
  menunggu: "#9E9E9E",
  dikerjakan: "#2196F3",
  tertunda: "#F59E0B",
  selesai: "#7E57C2",
  siap_diambil: "#4CAF50",
  diambil: "#2E7D32",
  dibatalkan: "#E53935",
};

export function GrafikWoStatusDonut({
  data,
  judul = "Status Work Order",
  keterangan = "Komposisi dan beban pengerjaan mobil saat ini",
}: {
  data: WoStatusItem[];
  judul?: string;
  keterangan?: string;
}) {
  const router = useRouter();

  // Hitung total semua status
  const total = React.useMemo(() => {
    return data.reduce((acc, cur) => acc + (cur.jumlah || 0), 0);
  }, [data]);

  // Saring hanya yang memiliki jumlah > 0 untuk diagram donat
  const dataPie = React.useMemo(() => {
    return data
      .filter((item) => item.jumlah > 0)
      .map((item) => ({
        ...item,
        label: (STATUS_WO[item.status as StatusWO]?.label ?? item.status),
        color: WARNA_STATUS[item.status] || "#9E9E9E",
      }));
  }, [data]);

  function handlePilihStatus(status: string) {
    router.push(`/work-orders?status=${encodeURIComponent(status)}`);
  }

  return (
    <Card className="flex flex-col border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
        <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between pt-2">
        {total === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <FileText className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-text">Belum ada Work Order</p>
            <p className="mt-1 text-xs text-text-muted">
              Tidak ada data WO aktif atau selesai untuk ditampilkan pada periode ini.
            </p>
          </div>
        ) : (
          <div>
            <div className="relative h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as {
                          status: string;
                          label: string;
                          jumlah: number;
                          color: string;
                        };
                        const persen = total > 0 ? Math.round((item.jumlah / total) * 100) : 0;
                        return (
                          <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                            <div className="flex items-center gap-2 font-medium text-text">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.label}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-4 text-text-muted">
                              <span className="font-semibold text-text tabular-nums">
                                {item.jumlah} WO ({persen}%)
                              </span>
                              <span className="text-[10px] text-primary">Klik untuk membuka</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={dataPie}
                    dataKey="jumlah"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    cursor="pointer"
                    onClick={(_, index) => {
                      if (dataPie[index]) handlePilihStatus(dataPie[index].status);
                    }}
                  >
                    {dataPie.map((entry) => (
                      <Cell
                        key={`cell-${entry.status}`}
                        fill={entry.color}
                        stroke="var(--bg-panel)"
                        strokeWidth={2}
                        className="transition-opacity hover:opacity-85 cursor-pointer"
                        onClick={() => handlePilihStatus(entry.status)}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Total di tengah donat */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tracking-tight text-text tabular-nums">
                  {total}
                </span>
                <span className="text-[11px] font-medium text-text-muted">Total WO</span>
              </div>
            </div>

            {/* Daftar Legenda & Tautan Langsung per Status */}
            <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {data.map((item) => {
                const label = STATUS_WO[item.status as StatusWO]?.label ?? item.status;
                const warna = WARNA_STATUS[item.status] || "#9E9E9E";
                return (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => handlePilihStatus(item.status)}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-bg-app/50 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: warna }}
                      />
                      <span className="truncate text-text-muted text-[11px]">{label}</span>
                    </div>
                    <span className="ml-1.5 font-semibold text-text tabular-nums text-xs">
                      {item.jumlah}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
