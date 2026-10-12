/**
 * Ограничение генераций В ПАМЯТИ ПРОЦЕССА — запасной вариант, когда не настроен Redis
 * (см. lib/server/shared-rate-limit.ts).
 *
 * ⚠️ Подходит только для локальной разработки и закрытого теста на одном сервере:
 *  - счётчики сбрасываются при перезапуске;
 *  - на serverless-платформах (Vercel и т.п.) у каждого экземпляра свои счётчики;
 *  - IP берётся из заголовка x-forwarded-for, который клиент может подделать,
 *    если перед приложением нет доверенного прокси.
 */

import { listingsCount } from "@/lib/site";

type Window = { count: number; resetAt: number };

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

const perIpHour = new Map<string, Window>();
const perIpDay = new Map<string, Window>();
let globalDay: Window = { count: 0, resetAt: 0 };
const inFlight = new Set<string>();

function readLimit(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getLimits() {
  return {
    perHour: readLimit("GENERATION_LIMIT_PER_HOUR", 10),
    /** Бесплатная пробная квота на клиента в сутки (показывается на лендинге). */
    perDay: readLimit("GENERATION_LIMIT_PER_DAY", 5),
    globalPerDay: readLimit("GENERATION_LIMIT_GLOBAL_PER_DAY", 300),
  };
}

/** Сколько клиентов храним максимум. Защищает память от потока запросов с разных IP. */
const MAX_TRACKED_CLIENTS = 10_000;
const CLEANUP_INTERVAL = 60 * 1000;
let lastCleanup = 0;

/** Текущее окно клиента без записи в карту (чтобы отклонённые запросы не занимали память). */
function peek(map: Map<string, Window>, key: string, period: number, now: number): Window {
  const existing = map.get(key);
  return existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + period };
}

function store(map: Map<string, Window>, key: string, window: Window) {
  if (map.get(key) === window) return;
  map.delete(key); // переносим ключ в конец порядка вставки
  if (map.size >= MAX_TRACKED_CLIENTS) {
    // Вытесняем самую старую запись. Общий суточный лимит при этом продолжает действовать.
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, window);
}

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, w] of perIpHour) if (w.resetAt <= now) perIpHour.delete(key);
  for (const [key, w] of perIpDay) if (w.resetAt <= now) perIpDay.delete(key);
}

export type LimitRejection = {
  ok: false;
  /** unavailable — не удалось проверить лимит (хранилище недоступно). */
  reason: "busy" | "rate_limited" | "unavailable";
  retryAfterSeconds: number;
  message: string;
  /** Остаток личной бесплатной квоты, если он известен. 0 — исчерпана именно она. */
  remainingToday?: number;
};

export type LimitResult =
  | {
      ok: true;
      release: () => void | Promise<void>;
      refund: () => void | Promise<void>;
      remainingToday: () => number;
    }
  | LimitRejection;

/** «7 ч 12 мин», «35 мин». Окна скользящие: отсчёт идёт от первого запроса, а не от полуночи. */
function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} ч ${minutes % 60} мин` : `${minutes} мин`;
}

export const BUSY: LimitRejection = {
  ok: false,
  reason: "busy",
  retryAfterSeconds: 5,
  message: "Предыдущее объявление ещё создаётся. Дождитесь результата.",
};

/** Отказ по одному из лимитов: общему суточному, личному суточному или часовому. */
export function limitRejection(
  kind: "global" | "day" | "hour",
  waitMs: number,
  remainingToday?: number,
): LimitRejection {
  const limits = getLimits();
  const wait = formatWait(waitMs);
  const message =
    kind === "global"
      ? `Сервис временно исчерпал общий лимит объявлений. Попробуйте через ${wait}.`
      : kind === "day"
        ? `Бесплатный лимит — ${listingsCount(limits.perDay)} за 24 часа — исчерпан. Новые бесплатные объявления станут доступны через ${wait}.`
        : `Достигнут лимит: ${listingsCount(limits.perHour)} в час. Повторите через ${wait}.`;
  return {
    ok: false,
    reason: "rate_limited",
    retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
    message,
    ...(kind === "day" ? { remainingToday: 0 } : remainingToday !== undefined ? { remainingToday } : {}),
  };
}

/**
 * Резервирует одну генерацию для клиента. Вызывайте release() по завершении запроса.
 * Попытка засчитывается сразу — это защищает бюджет от автоматических повторов.
 * refund() возвращает попытку, если запрос к ИИ заведомо не был оплачен
 * (неверный ключ, перегрузка сервиса и т.п.).
 */
export function acquireGeneration(clientKey: string, now = Date.now()): LimitResult {
  const limits = getLimits();
  cleanup(now);

  if (inFlight.has(clientKey)) return BUSY;

  if (globalDay.resetAt <= now) globalDay = { count: 0, resetAt: now + DAY };
  if (globalDay.count >= limits.globalPerDay) return limitRejection("global", globalDay.resetAt - now);

  const hour = peek(perIpHour, clientKey, HOUR, now);
  const day = peek(perIpDay, clientKey, DAY, now);
  if (day.count >= limits.perDay) return limitRejection("day", day.resetAt - now);
  if (hour.count >= limits.perHour) {
    return limitRejection("hour", hour.resetAt - now, Math.max(0, limits.perDay - day.count));
  }

  hour.count += 1;
  day.count += 1;
  store(perIpHour, clientKey, hour);
  store(perIpDay, clientKey, day);
  globalDay.count += 1;
  const global = globalDay;
  inFlight.add(clientKey);

  let released = false;
  let refunded = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      inFlight.delete(clientKey);
    },
    refund: () => {
      if (refunded) return;
      refunded = true;
      // Окна могли смениться за время запроса — тогда возвращать нечего.
      if (hour.count > 0) hour.count -= 1;
      if (day.count > 0) day.count -= 1;
      if (global.count > 0) global.count -= 1;
    },
    remainingToday: () => Math.max(0, limits.perDay - day.count),
  };
}

/** Идентификатор клиента для лимитов. См. предупреждение о x-forwarded-for выше. */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local";
}

/** Только для тестов. */
export function __trackedClientsForTests() {
  return { hour: perIpHour.size, day: perIpDay.size };
}

/** Только для тестов. */
export function __resetRateLimitsForTests() {
  perIpHour.clear();
  perIpDay.clear();
  inFlight.clear();
  globalDay = { count: 0, resetAt: 0 };
  lastCleanup = 0;
}
