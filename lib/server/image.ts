import { ALLOWED_IMAGE_TYPES, MAX_API_IMAGE_BYTES, MAX_IMAGE_BYTES, type AllowedImageType } from "@/lib/listing-schema";

export type ImageCheck =
  | { ok: true; mediaType: AllowedImageType; base64: string }
  | { ok: false; message: string };

/** Определяет реальный формат по сигнатуре файла, а не по расширению или MIME от клиента. */
function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Проверяет загруженную фотографию. Изображение обрабатывается только в памяти
 * и никуда не сохраняется.
 */
export async function checkImage(file: File): Promise<ImageCheck> {
  if (file.size === 0) return { ok: false, message: "Файл фотографии пустой." };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Фотография больше 5 МБ. Выберите файл меньшего размера." };
  }
  // Браузер обычно уменьшает фото заранее; сюда попадают только файлы, которые сжать не удалось.
  if (file.size > MAX_API_IMAGE_BYTES) {
    return {
      ok: false,
      message: "Фотография слишком большая для обработки ИИ (больше 3,75 МБ после подготовки). Уменьшите её или выберите другое фото.",
    };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Поддерживаются только фотографии JPEG, PNG и WebP." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(bytes);
  if (!detected) {
    return { ok: false, message: "Файл не похож на изображение JPEG, PNG или WebP." };
  }

  return { ok: true, mediaType: detected, base64: Buffer.from(bytes).toString("base64") };
}
