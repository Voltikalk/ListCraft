/**
 * Ограничение попыток входа, регистрации и сброса пароля — защита от перебора паролей
 * и рассылки писем на чужие адреса.
 *
 * Зачем своё, если у Supabase есть лимиты: все запросы к Supabase идут с нашего сервера,
 * поэтому Supabase видит один IP на всех посетителей и не отличит атакующего от остальных.
 *
 * Счётчики — в Upstash Redis (если настроен) или в памяти процесса. В хранилище нет
 * ни IP, ни почты: ключи — HMAC от них. Если Redis недоступен, считаем в памяти, а не
 * блокируем вход всем подряд.
 */

import { clientId, getRedisConfig, logRedisError, pipeline, PROCESS_SECRET } from "@/lib/server/shared-rate-limit";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const PREFIX = "listcraft:auth:";

export type AuthAction = "login" | "signup" | "reset" | "password" | "yandex";
type Subject = "ip" | "email" | "user";
type Rule = { by: Subject; limit: number; windowMs: number };

export const AUTH_RULES: Record<AuthAction, Rule[]> = {
  login: [
    { by: "ip", limit: 10, windowMs: 15 * MINUTE },
    // Перебор одного аккаунта с разных адресов. Лимит мягче, чтобы чужие попытки
    // не закрывали владельцу вход надолго.
    { by: "email", limit: 20, windowMs: HOUR },
  ],
  signup: [{ by: "ip", limit: 5, windowMs: HOUR }],
  reset: [
    { by: "ip", limit: 5, windowMs: HOUR },
    { by: "email", limit: 3, windowMs: HOUR },
  ],
  password: [{ by: "user", limit: 5, windowMs: 15 * MINUTE }],
  yandex: [{ by: "ip", limit: 10, windowMs: 15 * MINUTE }],
};

export type AuthLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

type Window = { count: number; resetAt: number };
const MAX_TRACKED = 10_000;
const memory = new Map<string, Window>();

function consumeInMemory(key: string, rule: Rule, now: number): Window {
  const existing = memory.get(key);
  const window = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + rule.windowMs };
  window.count += 1;
  if (existing !== window) {
    memory.delete(key);
    if (memory.size >= MAX_TRACKED) {
      // Сначала выбрасываем истёкшие окна, потом — самое старое.
      for (const [k, w] of memory) if (w.resetAt <= now) memory.delete(k);
      if (memory.size >= MAX_TRACKED) {
        const oldest = memory.keys().next().value;
        if (oldest !== undefined) memory.delete(oldest);
      }
    }
    memory.set(key, window);
  }
  return window;
}

async function consumeInRedis(
  config: NonNullable<ReturnType<typeof getRedisConfig>>,
  keys: string[],
  rules: Rule[],
): Promise<Window[]> {
  const commands = keys.flatMap((key, i) => [
    ["SET", key, 0, "NX", "PX", rules[i].windowMs],
    ["INCR", key],
    ["PTTL", key],
  ]);
  const result = await pipeline(config, commands);
  const now = Date.now();
  return keys.map((key, i) => {
    const ttl = Number(result[i * 3 + 2]);
    return {
      count: Number(result[i * 3 + 1]),
      resetAt: now + (Number.isFinite(ttl) && ttl > 0 ? ttl : rules[i].windowMs),
    };
  });
}

/**
 * Засчитывает попытку и сообщает, можно ли её выполнять. Считаются все попытки,
 * в том числе удачные: так проще и надёжнее против перебора.
 */
export async function consumeAuthAttempt(
  action: AuthAction,
  subjects: Partial<Record<Subject, string>>,
  now = Date.now(),
): Promise<AuthLimitResult> {
  const rules = AUTH_RULES[action].filter((rule) => subjects[rule.by]);
  if (!rules.length) return { ok: true };

  const config = getRedisConfig();
  const secret = config?.token ?? PROCESS_SECRET;
  const keys = rules.map((rule) => `${PREFIX}${action}:${rule.by}:${clientId(subjects[rule.by]!, secret)}`);

  let windows: Window[] | null = null;
  if (config) {
    try {
      windows = await consumeInRedis(config, keys, rules);
    } catch (error) {
      logRedisError("auth", error);
    }
  }
  windows ??= keys.map((key, i) => consumeInMemory(key, rules[i], now));

  let waitMs = 0;
  windows.forEach((window, i) => {
    if (window.count > rules[i].limit) waitMs = Math.max(waitMs, window.resetAt - now);
  });
  return waitMs > 0 ? { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) } : { ok: true };
}

/** «Слишком много попыток. Повторите через 12 мин.» */
export function tooManyAttemptsMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Слишком много попыток. Повторите через ${minutes} мин.`;
}

/** Только для тестов. */
export function __resetAuthLimitsForTests() {
  memory.clear();
}
