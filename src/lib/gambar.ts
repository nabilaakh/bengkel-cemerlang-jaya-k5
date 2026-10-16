import imageCompression from "browser-image-compression";

/**
 * Kompresi foto sebelum diunggah ke Supabase Storage (PRD 11.4):
 * - Sisi terpanjang maksimal 1600 px
 * - Format WebP
 * - Mutu 0.8 (target di bawah 400 KB)
 */
export async function kompresiFoto(file: File): Promise<File> {
  const opsi = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
  };

  try {
    const hasil = await imageCompression(file, opsi);
    // Pastikan nama file berakhiran .webp
    const namaBaru = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    return new File([hasil], namaBaru, { type: "image/webp" });
  } catch (err) {
    console.error("Kompresi gambar gagal, menggunakan file asli:", err);
    return file;
  }
}
