import { History } from "lucide-react";
import { BadgeStatus } from "@/components/BadgeStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tanggal } from "@/lib/format";

interface RiwayatItem {
  id: number;
  created_at: string;
  dari_status: string | null;
  ke_status: string;
  catatan: string | null;
  profiles?: { nama: string } | null;
}

export function LinimasaRiwayat({ riwayat }: { riwayat: RiwayatItem[] }) {
  if (!riwayat || riwayat.length === 0) return null;

  return (
    <Card className="border-border bg-card shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-text flex items-center gap-2">
          <History className="size-4 text-primary" />
          Riwayat Perubahan Status Work Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-6 before:absolute before:bottom-0 before:left-2.5 before:top-2 before:w-0.5 before:bg-border">
          {riwayat.map((r) => {
            const waktu = new Date(r.created_at);
            const waktuStr = `${tanggal(r.created_at)} pukul ${waktu.toLocaleTimeString(
              "id-ID",
              { hour: "2-digit", minute: "2-digit" },
            )}`;

            return (
              <div key={r.id} className="relative">
                {/* Dot */}
                <div className="absolute -left-[19px] top-1 size-2 rounded-full border-2 border-primary bg-card" />

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-text">
                      {r.profiles?.nama || "Sistem"}
                    </span>
                    <span className="text-text-muted">· {waktuStr}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    {r.dari_status && (
                      <>
                        <BadgeStatus status={r.dari_status} />
                        <span className="text-text-muted">→</span>
                      </>
                    )}
                    <BadgeStatus status={r.ke_status} />
                  </div>

                  {r.catatan && (
                    <p className="mt-1 text-xs text-text-body bg-muted/40 rounded-md p-2">
                      <span className="font-medium text-text">Catatan: </span>
                      {r.catatan}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
