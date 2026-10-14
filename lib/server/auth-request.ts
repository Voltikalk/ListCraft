import { headers } from "next/headers";
import { getTurnstileSecret, verifyTurnstile } from "@/lib/server/turnstile";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

/**
 * Публичный адрес сайта для ссылок в письмах и для Яндекс ID.
 * Заголовку Host не доверяем: в production адрес берётся только из настроек,
 * иначе подделанный Host мог бы увести ссылку из письма на чужой домен.
 */
export async function getSiteOrigin(): Promise<string | null> {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }
  if (process.env.NODE_ENV !== "production") {
    const host = (await headers()).get("host") ?? "";
    if (LOCAL_HOST.test(host)) return `http://${host}`;
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : null;
}

export const TURNSTILE_FIELD = "cf-turnstile-response";

/** Проверка «Я не робот», если Turnstile настроен. Возвращает текст ошибки или null. */
export async function checkHuman(formData: FormData, clientKey: string): Promise<string | null> {
  const secret = getTurnstileSecret();
  if (!secret) return null;
  const token = formData.get(TURNSTILE_FIELD);
  const result = await verifyTurnstile(secret, typeof token === "string" ? token : "", clientKey);
  if (result.ok) return null;
  return result.reason === "unavailable"
    ? "Проверка «Я не робот» временно недоступна. Попробуйте через минуту."
    : "Не удалось пройти проверку «Я не робот». Попробуйте ещё раз.";
}
