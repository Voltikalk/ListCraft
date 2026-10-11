import { ALLOWED_IMAGE_TYPES, MAX_API_IMAGE_BYTES, MAX_IMAGE_BYTES } from "@/lib/listing-schema";

/** Длинная сторона после уменьшения. Меньше пикселей — меньше токенов и быстрее загрузка. */
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.85;

export type PreparedImage = { file: File; previewUrl: string };

export function validateImageFile(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Поддерживаются только фотографии JPEG, PNG и WebP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Фотография больше 5 МБ. Выберите файл меньшего размера.";
  }
  if (file.size === 0) return "Файл фотографии пустой.";
  return null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

/**
 * Уменьшает фото в браузере и перекодирует в JPEG. Это экономит токены ИИ и
 * трафик, а также удаляет EXIF-метаданные (в том числе геолокацию).
 * Если браузер не справился, отправляется исходный файл — сервер проверит его сам.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(sourceUrl);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff"; // прозрачный фон PNG/WebP → белый
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size === 0 || blob.size > MAX_API_IMAGE_BYTES) throw new Error("encode");

    URL.revokeObjectURL(sourceUrl);
    const prepared = new File([blob], "photo.jpg", { type: "image/jpeg" });
    return { file: prepared, previewUrl: URL.createObjectURL(prepared) };
  } catch (error) {
    if (error instanceof Error && error.message === "decode") {
      URL.revokeObjectURL(sourceUrl);
      throw new Error("Не удалось открыть изображение. Возможно, файл повреждён.");
    }
    // Сжатие не удалось — используем оригинал, если он укладывается в лимит API (5 МБ в base64).
    if (file.size > MAX_API_IMAGE_BYTES) {
      URL.revokeObjectURL(sourceUrl);
      throw new Error("Не удалось уменьшить фото в браузере, а исходный файл больше 3,75 МБ. Выберите фото поменьше.");
    }
    return { file, previewUrl: sourceUrl };
  }
}
