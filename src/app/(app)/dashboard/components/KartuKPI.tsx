import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KartuKPIProps {
  judul: string;
  nilai: string | number;
  ikon: LucideIcon;
  subteks?: string;
  nilaiSekarang?: number;
  nilaiSebelumnya?: number;
  formatNilai?: "mata_uang" | "angka" | "persen";
  satuan?: string;
  tautan?: string;
  balikWarna?: boolean; // Jika true: naik merah, turun hijau (misal WO terlambat)
}

export function KartuKPI({
  judul,
  nilai,
  ikon: Ikon,
  subteks,
  nilaiSekarang,
  nilaiSebelumnya,
  tautan,
  balikWarna = false,
}: KartuKPIProps) {
  // Hitung persentase perubahan dibanding periode sebelumnya
  let deltaPersen: number | null = null;
  let labelDelta = "";
  let arahDelta: "naik" | "turun" | "tetap" = "tetap";

  if (nilaiSekarang !== undefined && nilaiSebelumnya !== undefined) {
    if (nilaiSebelumnya === 0) {
      if (nilaiSekarang > 0) {
        deltaPersen = 100;
        arahDelta = "naik";
        labelDelta = "+100% dari periode lalu";
      } else {
        deltaPersen = 0;
        arahDelta = "tetap";
        labelDelta = "Stabil dari periode lalu";
      }
    } else {
      const diff = nilaiSekarang - nilaiSebelumnya;
      const pct = (diff / nilaiSebelumnya) * 100;
      deltaPersen = Math.round(pct * 10) / 10;
      if (deltaPersen > 0) {
        arahDelta = "naik";
        labelDelta = `▲ ${deltaPersen}% dari periode lalu`;
      } else if (deltaPersen < 0) {
        arahDelta = "turun";
        labelDelta = `▼ ${Math.abs(deltaPersen)}% dari periode lalu`;
      } else {
        arahDelta = "tetap";
        labelDelta = "0% dari periode lalu";
      }
    }
  }

  // Tentukan warna: naik hijau, turun merah (atau sebaliknya jika balikWarna = true)
  const isPositif = balikWarna ? arahDelta === "turun" : arahDelta === "naik";
  const isNegatif = balikWarna ? arahDelta === "naik" : arahDelta === "turun";

  const konten = (
    <Card className="overflow-hidden border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-text-muted">{judul}</span>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
            <Ikon className="size-4.5" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-text tabular-nums">
            {nilai}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs">
          {labelDelta ? (
            <div
              className={cn(
                "inline-flex items-center gap-1 font-medium tabular-nums",
                isPositif && "text-success",
                isNegatif && "text-danger",
                arahDelta === "tetap" && "text-text-muted",
              )}
            >
              {arahDelta === "naik" && <TrendingUp className="size-3.5" />}
              {arahDelta === "turun" && <TrendingDown className="size-3.5" />}
              {arahDelta === "tetap" && <Minus className="size-3.5" />}
              <span>{labelDelta}</span>
            </div>
          ) : (
            <span className="text-text-muted">{subteks || "Periode berjalan"}</span>
          )}

          {tautan && (
            <span className="text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Lihat &rarr;
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (tautan) {
    return (
      <Link href={tautan} className="group block focus:outline-hidden">
        {konten}
      </Link>
    );
  }

  return konten;
}
