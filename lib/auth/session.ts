/**
 * Способы входа (claim `amr` в токене Supabase), которые подтверждают доступ к почте:
 * ссылка из письма о регистрации, восстановлении, magic link (так же входим через Яндекс ID).
 */
const EMAIL_PROOF_METHODS = new Set(["otp", "recovery", "magiclink", "email/signup", "invite", "email_change"]);

/** Сколько времени после перехода по ссылке из письма можно задать новый пароль без старого. */
export const PASSWORD_RESET_WINDOW_MS = 15 * 60 * 1000;

/**
 * true — пользователь недавно (не раньше `windowMs`) вошёл по ссылке из письма.
 * Нужна для страницы «Новый пароль»: иначе любой с украденной сессией сменил бы пароль,
 * не зная старого. Метка времени в `amr` не меняется при обновлении токена.
 */
export function hasRecentEmailProof(amr: unknown, now = Date.now(), windowMs = PASSWORD_RESET_WINDOW_MS): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (typeof method !== "string" || !EMAIL_PROOF_METHODS.has(method)) return false;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
    const ageMs = now - timestamp * 1000;
    return ageMs >= -60_000 && ageMs <= windowMs;
  });
}
