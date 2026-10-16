"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export const PILIHAN_PERIODE = [
  { id: "hari_ini", label: "Hari ini" },
  { id: "7_hari", label: "7 hari" },
  { id: "30_hari", label: "30 hari" },
  { id: "bulan_ini", label: "Bulan ini" },
] as const;

export type PeriodeDashboard = (typeof PILIHAN_PERIODE)[number]["id"];

export function PenyaringPeriode({
  periodeAktif = "bulan_ini",
}: {
  periodeAktif?: PeriodeDashboard;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function gantiPeriode(periode: PeriodeDashboard) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periode", periode);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-xs">
      <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-text-muted">
        <Calendar className="size-3.5" />
        <span className="hidden sm:inline">Periode:</span>
      </div>
      <div className="flex items-center gap-1">
        {PILIHAN_PERIODE.map((item) => {
          const aktif = item.id === periodeAktif;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => gantiPeriode(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                aktif
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-text-muted hover:bg-primary-soft/50 hover:text-text",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
