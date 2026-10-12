import { listingInputSchema, MAX_API_IMAGE_BYTES, type GenerateErrorCode, type GenerateResponse } from "@/lib/listing-schema";
import { generateListing, getApiKey, ListingGenerationError, setupMessage, type ListingImage } from "@/lib/server/groq";
import { checkImage } from "@/lib/server/image";
import { getClientKey } from "@/lib/server/rate-limit";
import { reserveGeneration } from "@/lib/server/shared-rate-limit";
import { getTurnstileSecret, verifyTurnstile } from "@/lib/server/turnstile";

// Ответ модели с фото обычно 5–30 с; тайм-аут запроса к ИИ — 90 с (см. lib/server/groq.ts).
export const maxDuration = 120;

/** Максимальный размер тела запроса: фото + текстовые поля + накладные расходы multipart. */
const MAX_BODY_BYTES = MAX_API_IMAGE_BYTES + 64 * 1024;

const TEXT_FIELDS = ["market", "productName", "brand", "condition", "dimensions", "color", "material", "details"] as const;

function fail(
  status: number,
  code: GenerateErrorCode,
  message: string,
  extra?: { fields?: Record<string, string>; headers?: Record<string, string>; remainingToday?: number },
) {
  const body: GenerateResponse = {
    ok: false,
    error: { code, message, ...(extra?.fields ? { fields: extra.fields } : {}) },
    ...(extra?.remainingToday !== undefined ? { remainingToday: extra.remainingToday } : {}),
  };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra?.headers } });
}

/**
 * Читает тело запроса, но не больше limit байт. Заголовку content-length не доверяем:
 * его может не быть (chunked) или он может не совпадать с реальным размером.
 */
async function readBodyLimited(request: Request, limit: number): Promise<Blob | null> {
  if (!request.body) return new Blob([]);
  const reader = request.body.getReader();
  const chunks: BlobPart[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new Blob(chunks);
}

const TOO_LARGE_MESSAGE = "Запрос слишком большой. Уменьшите фотографию или выберите другую.";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return fail(415, "validation_error", "Неверный формат запроса. Обновите страницу и попробуйте снова.");
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return fail(413, "payload_too_large", TOO_LARGE_MESSAGE);
  }

  let form: FormData;
  try {
    const body = await readBodyLimited(request, MAX_BODY_BYTES);
    if (!body) return fail(413, "payload_too_large", TOO_LARGE_MESSAGE);
    form = await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    return fail(400, "validation_error", "Не удалось прочитать данные формы. Обновите страницу и попробуйте снова.");
  }

  // 1. Проверка текстовых полей.
  const raw: Record<string, unknown> = {};
  for (const name of TEXT_FIELDS) {
    const value = form.get(name);
    if (typeof value === "string") raw[name] = value;
  }
  const parsed = listingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fields[key] ??= issue.message;
    }
    return fail(400, "validation_error", "Проверьте заполнение формы.", { fields });
  }

  // 2. Проверка фотографии (необязательной).
  let image: ListingImage | null = null;
  const photo = form.get("photo");
  if (photo !== null && typeof photo !== "string" && photo.size > 0) {
    const check = await checkImage(photo);
    if (!check.ok) return fail(400, "image_invalid", check.message, { fields: { photo: check.message } });
    image = { mediaType: check.mediaType, base64: check.base64 };
  } else if (typeof photo === "string" && photo !== "") {
    return fail(400, "image_invalid", "Фотография передана в неверном формате.");
  }

  // 3. Без ключа не тратим лимит и сразу объясняем, как настроить.
  if (!getApiKey()) {
    return fail(
      503,
      "missing_api_key",
      setupMessage(
        "Генерация через ИИ не настроена: на сервере не задан GROQ_API_KEY. Добавьте ключ в файл .env.local и перезапустите сервер.",
      ),
    );
  }

  const clientKey = getClientKey(request.headers);

  // 4. Проверка на бота (если включён Cloudflare Turnstile) — до списания лимита.
  const turnstileSecret = getTurnstileSecret();
  if (turnstileSecret) {
    const token = form.get("cf-turnstile-response");
    const check = await verifyTurnstile(turnstileSecret, typeof token === "string" ? token : "", clientKey);
    if (!check.ok) {
      return check.reason === "unavailable"
        ? fail(503, "service_unavailable", "Не удалось проверить, что вы не робот. Попробуйте через минуту.")
        : fail(403, "captcha_failed", "Проверка «Я не робот» не пройдена или устарела. Пройдите её ещё раз.");
    }
  }

  // 5. Ограничение частоты генераций.
  const limit = await reserveGeneration(clientKey);
  if (!limit.ok) {
    if (limit.reason === "unavailable") {
      return fail(503, "service_unavailable", limit.message, { headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    return fail(429, limit.reason, limit.message, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
      remainingToday: limit.remainingToday,
    });
  }

  try {
    const listing = await generateListing(parsed.data, image);
    const body: GenerateResponse = { ok: true, listing, remainingToday: limit.remainingToday() };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ListingGenerationError) {
      if (error.refundable) await limit.refund();
      // Неоплаченные попытки возвращены (refund), остальные засчитаны — сообщаем актуальный остаток.
      return fail(error.httpStatus, error.code, error.userMessage, { remainingToday: limit.remainingToday() });
    }
    console.error("[generate] internal error", { type: error instanceof Error ? error.name : typeof error });
    return fail(500, "internal_error", "Внутренняя ошибка сервера. Попробуйте ещё раз.", {
      remainingToday: limit.remainingToday(),
    });
  } finally {
    await limit.release();
  }
}
