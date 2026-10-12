/**
 * Проверка Cloudflare Turnstile — защита от ботов перед тратой лимита и запросом к ИИ.
 * Включается, когда на сервере задан TURNSTILE_SECRET_KEY (в браузере нужен NEXT_PUBLIC_TURNSTILE_SITE_KEY).
 * Документация: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5_000;
/** Токен Turnstile не длиннее 2048 символов. */
const MAX_TOKEN_LENGTH = 2048;

export function getTurnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || null;
}

export type TurnstileResult = { ok: true } | { ok: false; reason: "failed" | "unavailable" };

/** Токен одноразовый: повторная отправка того же токена не пройдёт. */
export async function verifyTurnstile(secret: string, token: string, remoteIp?: string): Promise<TurnstileResult> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "failed" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "local") body.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { success?: unknown; "error-codes"?: unknown };
    if (data.success === true) return { ok: true };

    const codes = Array.isArray(data["error-codes"]) ? data["error-codes"].map(String) : [];
    // Ошибки настройки сервера — не вина посетителя.
    if (codes.some((code) => code === "missing-input-secret" || code === "invalid-input-secret" || code === "internal-error")) {
      console.error("[turnstile] verification misconfigured", { codes });
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "failed" };
  } catch (error) {
    console.error("[turnstile] siteverify request failed", { type: error instanceof Error ? error.name : typeof error });
    return { ok: false, reason: "unavailable" };
  }
}
