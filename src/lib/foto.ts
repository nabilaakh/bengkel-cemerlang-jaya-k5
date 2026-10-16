import imageCompression from "browser-image-compression";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Kompresi foto utama sesuai PRD 11.4:
 * Sisi terpanjang maksimal 1600 px, format WebP, mutu 0,8, target < 400 KB.
 */
export async function kompresFotoUtama(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
  };
  return await imageCompression(file, options);
}

/**
 * Pembuatan thumbnail sesuai PRD 11.4:
 * Lebar maksimal 320 px, format WebP.
 */
export async function kompresThumbnail(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 320,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
  };
  return await imageCompression(file, options);
}

/**
 * Unggah foto dan thumbnail ke bucket privat foto-wo serta simpan ke tabel work_order_photos.
 */
export async function unggahFotoWorkOrder({
  supabase,
  workOrderId,
  jenis,
  file,
  userId,
}: {
  supabase: SupabaseClient<Database>;
  workOrderId: string;
  jenis: "stnk" | "kondisi_awal" | "kondisi_akhir" | "pengerjaan";
  file: File;
  userId?: string;
}): Promise<string> {
  const uuid = crypto.randomUUID();
  const pathUtama = `${workOrderId}/${jenis}/${uuid}.webp`;
  const pathThumb = `${workOrderId}/${jenis}/thumb/${uuid}.webp`;

  const [fotoUtama, fotoThumb] = await Promise.all([
    kompresFotoUtama(file),
    kompresThumbnail(file),
  ]);

  // Unggah foto utama
  const { error: errUtama } = await supabase.storage
    .from("foto-wo")
    .upload(pathUtama, fotoUtama, {
      contentType: "image/webp",
      upsert: true,
    });

  if (errUtama) {
    throw new Error(`Gagal mengunggah foto: ${errUtama.message}`);
  }

  // Unggah thumbnail (best-effort)
  await supabase.storage
    .from("foto-wo")
    .upload(pathThumb, fotoThumb, {
      contentType: "image/webp",
      upsert: true,
    });

  // Simpan metadata ke work_order_photos
  const { error: errDb } = await supabase.from("work_order_photos").insert({
    work_order_id: workOrderId,
    jenis,
    path: pathUtama,
    diunggah_oleh: userId || null,
  });

  if (errDb) {
    throw new Error(`Gagal menyimpan data foto ke database: ${errDb.message}`);
  }

  return pathUtama;
}
