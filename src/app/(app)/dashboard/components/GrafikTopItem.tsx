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
import { Package, Wrench } from "lucide-react";
import { rupiah } from "@/lib/format";

export interface TopItemData {
  nama: string;
  jumlah: number;
  pendapatan: number;
}

export function GrafikTopItem({
  dataPart = [],
  dataJasa = [],
  judul = "Item Terlaris",
  keterangan = "5 item dengan penjualan dan pendapatan tertinggi",
}: {
  dataPart?: TopItemData[];
  dataJasa?: TopItemData[];
  judul?: string;
  keterangan?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"part" | "jasa">("part");

  const dataAktif = tab === "part" ? dataPart : dataJasa;

  const adaData = React.useMemo(() => {
    return dataAktif.length > 0 && dataAktif.some((d) => (d.jumlah || 0) > 0);
  }, [dataAktif]);

  function handleKlik() {
    router.push("/inventory");
  }

  return (
    <Card className="flex flex-col border-border bg-card">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-text">{judul}</CardTitle>
          <CardDescription className="text-xs text-text-muted">{keterangan}</CardDescription>
        </div>

        {/* Toggle Spare Part / Jasa */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-app p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("part")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
              tab === "part"
                ? "bg-card text-text shadow-xs"
                : "text-text-muted hover:text-text"
            }`}
          >
            <Package className="size-3" />
            <span>Part</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("jasa")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
              tab === "jasa"
                ? "bg-card text-text shadow-xs"
                : "text-text-muted hover:text-text"
            }`}
          >
            <Wrench className="size-3" />
            <span>Jasa</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between pt-2">
        {!adaData ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Package className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-text">Belum ada penjualan di periode ini</p>
            <p className="mt-1 text-xs text-text-muted">
              Item terlaris akan otomatis terisi saat Work Order dengan pemakaian {tab === "part" ? "spare part" : "jasa"} ditagihkan.
            </p>
          </div>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataAktif}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                onClick={handleKlik}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EAF2FA" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#757575", fontSize: 11 }}
                  axisLine={{ stroke: "#EAF2FA" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nama"
                  width={110}
                  tick={{ fill: "#212121", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: string) =>
                    val.length > 14 ? `${val.slice(0, 14)}...` : val
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as TopItemData;
                      return (
                        <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-lg">
                          <p className="font-semibold text-text">{item.nama}</p>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-text-muted">Jumlah Terpakai:</span>
                              <span className="font-bold text-text tabular-nums">
                                {item.jumlah} {tab === "part" ? "unit" : "kali"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-text-muted">Total Pendapatan:</span>
                              <span className="font-bold text-primary tabular-nums">
                                {rupiah(item.pendapatan || 0)}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 border-t border-border/70 pt-1 text-[10px] text-primary">
                            Klik untuk membuka data Inventory
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="jumlah"
                  name="Jumlah Terjual"
                  fill={tab === "part" ? "#7E57C2" : "#2196F3"}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
          <span className="text-text-muted">Diurutkan berdasarkan total pendapatan</span>
          <button
            type="button"
            onClick={handleKlik}
            className="font-medium text-primary hover:underline"
          >
            Kelola Inventory &rarr;
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
