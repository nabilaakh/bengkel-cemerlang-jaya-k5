"use client";

import { Eye, ArrowRight, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Json } from "@/types/database";

export interface LogAuditItem {
  id: number;
  waktu: string;
  pelaku_id: string | null;
  pelaku_peran: string | null;
  nama_pelaku: string;
  aksi: string;
  tabel: string;
  data_id: string | null;
  sebelum: Json | null;
  sesudah: Json | null;
  alasan: string | null;
}

function formatNilai(val: unknown): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-muted-foreground italic">(kosong)</span>;
  }
  if (typeof val === "boolean") {
    return (
      <Badge variant="outline" className={val ? "text-success border-success/30" : "text-muted-foreground"}>
        {val ? "true" : "false"}
      </Badge>
    );
  }
  if (typeof val === "object") {
    return (
      <pre className="font-mono text-xs whitespace-pre-wrap max-h-32 overflow-auto bg-muted/40 p-1.5 rounded">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  }
  return <span className="break-all">{String(val)}</span>;
}

export function DialogDetailAudit({ log }: { log: LogAuditItem }) {
  const objSebelum =
    log.sebelum && typeof log.sebelum === "object" && !Array.isArray(log.sebelum)
      ? (log.sebelum as Record<string, unknown>)
      : {};
  const objSesudah =
    log.sesudah && typeof log.sesudah === "object" && !Array.isArray(log.sesudah)
      ? (log.sesudah as Record<string, unknown>)
      : {};

  const allKeys = Array.from(new Set([...Object.keys(objSebelum), ...Object.keys(objSesudah)])).sort();

  const getWarnaAksi = (aksi: string) => {
    switch (aksi.toUpperCase()) {
      case "INSERT":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300";
      case "UPDATE":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300";
      case "DELETE":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const waktuStr = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(log.waktu));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          Bandingkan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className={`font-semibold ${getWarnaAksi(log.aksi)}`}>
              {log.aksi}
            </Badge>
            <span className="font-semibold text-text text-base">
              Tabel <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{log.tabel}</code>
            </span>
            {log.data_id && (
              <span className="text-sm text-muted-foreground font-normal">
                (ID: <span className="font-mono font-medium text-text">{log.data_id}</span>)
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Waktu: <strong className="text-text">{waktuStr} WIB</strong>
            </span>
            <span>
              Pelaku: <strong className="text-text">{log.nama_pelaku}</strong>
              {log.pelaku_peran && (
                <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1.5 uppercase font-medium">
                  {log.pelaku_peran}
                </Badge>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          {log.alasan && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-amber-900 dark:text-amber-200">Alasan Perubahan: </span>
                <span className="text-amber-800 dark:text-amber-300">{log.alasan}</span>
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-1/4 font-semibold text-xs">Kolom / Properti</TableHead>
                  <TableHead className="w-[35%] font-semibold text-xs">Nilai Sebelum</TableHead>
                  <TableHead className="w-[8%] text-center text-xs text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                  </TableHead>
                  <TableHead className="w-[32%] font-semibold text-xs">Nilai Sesudah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {allKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Tidak ada data nilai sebelum dan sesudah.
                    </TableCell>
                  </TableRow>
                ) : (
                  allKeys.map((key) => {
                    const adaSebelum = key in objSebelum;
                    const adaSesudah = key in objSesudah;
                    const valSebelum = objSebelum[key];
                    const valSesudah = objSesudah[key];

                    const sama = adaSebelum && adaSesudah && JSON.stringify(valSebelum) === JSON.stringify(valSesudah);
                    const bertambah = !adaSebelum && adaSesudah;
                    const terhapus = adaSebelum && !adaSesudah;
                    const berubah = adaSebelum && adaSesudah && !sama;

                    let bgRow = "";
                    if (bertambah) bgRow = "bg-emerald-50/60 dark:bg-emerald-950/20";
                    else if (terhapus) bgRow = "bg-rose-50/60 dark:bg-rose-950/20";
                    else if (berubah) bgRow = "bg-amber-50/60 dark:bg-amber-950/20";

                    return (
                      <TableRow key={key} className={bgRow}>
                        <TableCell className="font-mono font-medium text-text pl-3 align-top py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span>{key}</span>
                            {bertambah && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0 px-1 border-0">
                                Baru
                              </Badge>
                            )}
                            {terhapus && (
                              <Badge className="bg-rose-100 text-rose-800 text-[10px] py-0 px-1 border-0">
                                Dihapus
                              </Badge>
                            )}
                            {berubah && (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px] py-0 px-1 border-0">
                                Berubah
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground align-top py-2.5">
                          {adaSebelum ? formatNilai(valSebelum) : <span className="text-muted-foreground/50">-</span>}
                        </TableCell>
                        <TableCell className="text-center align-top py-2.5 text-muted-foreground">
                          {berubah && <ArrowRight className="h-3 w-3 mx-auto text-amber-600" />}
                        </TableCell>
                        <TableCell className="font-medium text-text align-top py-2.5">
                          {adaSesudah ? formatNilai(valSesudah) : <span className="text-muted-foreground/50">-</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
