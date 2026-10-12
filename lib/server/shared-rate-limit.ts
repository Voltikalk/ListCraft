/**
 * Ограничение генераций в общем хранилище — Upstash Redis (REST API, без SDK).
 *
 * Нужно для Vercel и других serverless-платформ: там одновременно работает несколько
 * экземпляров функции, и счётчики в памяти (lib/server/rate-limit.ts) у каждого свои.
 * Если Redis не настроен, используется счётчик в памяти — годится только для разработки.
 *
 * В хранилище нет IP-адресов: ключ клиента — HMAC от IP. Все ключи живут не дольше суток.
 */

import { createHmac, randomBytes } from "node:crypto";
import {
  acquireGeneration,
  BUSY,
  DAY,
  getLimits,
  HOUR,
  limitRejection,
  type LimitRejection,
  type LimitResult,
} from "@/lib/server/rate-limit";

const PREFIX = "listcraft:rl:";
const REDIS_TIMEOUT_MS = 3_000;
/** Блокировка параллельной генерации; чуть дольше maxDuration маршрута (120 с). */
const LOCK_MS = 130_000;

type RedisConfig = { url: string; token: string };
type Command = (string | number)[];

/** Vercel Marketplace (Upstash) задаёт KV_REST_API_*, сам Upstash — UPSTASH_REDIS_REST_*. */
export function getRedisConfig(): RedisConfig | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

class RedisError extends Error {
  override name = "RedisError";
}

async function pipeline(config: RedisConfig, commands: Command[]): Promise<unknown[]> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands.map((command) => command.map(String))),
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new RedisError(`HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length !== commands.length) throw new RedisError("unexpected response");
  return data.map((item: { result?: unknown; error?: unknown }) => {
    if (item?.error !== undefined) throw new RedisError("command failed");
    return item?.result;
  });
}

const UNAVAILABLE: LimitRejection = {
  ok: false,
  reason: "unavailable",
  retryAfterSeconds: 30,
  message: "Сервис временно недоступен. Попробуйте через минуту.",
};

/** Для счётчиков в памяти: секрет живёт, пока жив процесс, — как и сами счётчики. */
const PROCESS_SECRET = randomBytes(32);

function clientId(clientKey: string, secret: string | Buffer): string {
  return createHmac("sha256", secret).update(clientKey).digest("base64url").slice(0, 24);
}

/** Остаток TTL в мс; для ключа без срока (не должно случаться) — полный период. */
function ttl(value: unknown, period: number): number {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : period;
}

let warnedMemoryFallback = false;

/**
 * Резервирует одну генерацию. Семантика как у acquireGeneration: попытка засчитывается сразу,
 * refund() возвращает её, release() снимает блокировку параллельных запросов.
 * Если Redis недоступен, генерация не разрешается — это защищает бюджет на ИИ.
 */
export async function reserveGeneration(clientKey: string): Promise<LimitResult> {
  const config = getRedisConfig();
  if (!config) {
    if (process.env.NODE_ENV === "production" && !warnedMemoryFallback) {
      warnedMemoryFallback = true;
      console.warn("[rate-limit] Redis не настроен — лимиты считаются в памяти экземпляра и ненадёжны");
    }
    return acquireGeneration(clientId(clientKey, PROCESS_SECRET));
  }

  const limits = getLimits();
  // Токен Redis — стабильный секрет, которого нет у посетителя. При его смене счётчики обнулятся.
  const id = clientId(clientKey, config.token);
  const lock = `${PREFIX}lock:${id}`;
  const global = `${PREFIX}global`;
  const day = `${PREFIX}day:${id}`;
  const hour = `${PREFIX}hour:${id}`;

  try {
    const [locked] = await pipeline(config, [["SET", lock, "1", "NX", "PX", LOCK_MS]]);
    if (locked !== "OK") return BUSY;
  } catch (error) {
    logRedisError("lock", error);
    return UNAVAILABLE;
  }

  try {
    // SET NX создаёт счётчик со сроком жизни только при первом запросе окна; INCR срок не меняет.
    const r = await pipeline(config, [
      ["SET", global, 0, "NX", "PX", DAY],
      ["INCR", global],
      ["PTTL", global],
      ["SET", day, 0, "NX", "PX", DAY],
      ["INCR", day],
      ["PTTL", day],
      ["SET", hour, 0, "NX", "PX", HOUR],
      ["INCR", hour],
      ["PTTL", hour],
    ]);
    const [globalCount, dayCount, hourCount] = [Number(r[1]), Number(r[4]), Number(r[7])];

    // Ключ без срока жизни (например, после возврата попытки в момент истечения окна) — чиним.
    const repair: Command[] = [];
    if (Number(r[2]) === -1) repair.push(["PEXPIRE", global, DAY]);
    if (Number(r[5]) === -1) repair.push(["PEXPIRE", day, DAY]);
    if (Number(r[8]) === -1) repair.push(["PEXPIRE", hour, HOUR]);

    const rejection =
      globalCount > limits.globalPerDay
        ? limitRejection("global", ttl(r[2], DAY))
        : dayCount > limits.perDay
          ? limitRejection("day", ttl(r[5], DAY))
          : hourCount > limits.perHour
            ? limitRejection("hour", ttl(r[8], HOUR), Math.max(0, limits.perDay - (dayCount - 1)))
            : null;

    if (rejection) {
      await pipeline(config, [...repair, ["DECR", global], ["DECR", day], ["DECR", hour], ["DEL", lock]]);
      return rejection;
    }
    if (repair.length) await pipeline(config, repair);

    let remaining = Math.max(0, limits.perDay - dayCount);
    let released = false;
    let refunded = false;
    return {
      ok: true,
      release: async () => {
        if (released) return;
        released = true;
        // Если не получилось — блокировка истечёт сама через LOCK_MS.
        await pipeline(config, [["DEL", lock]]).catch((error) => logRedisError("release", error));
      },
      refund: async () => {
        if (refunded) return;
        refunded = true;
        try {
          const [, newDay] = await pipeline(config, [["DECR", global], ["DECR", day], ["DECR", hour]]);
          remaining = Math.max(0, limits.perDay - Math.max(0, Number(newDay)));
        } catch (error) {
          logRedisError("refund", error);
        }
      },
      remainingToday: () => remaining,
    };
  } catch (error) {
    logRedisError("acquire", error);
    await pipeline(config, [["DEL", lock]]).catch(() => {});
    return UNAVAILABLE;
  }
}

/** В журнал — только тип ошибки, без адреса хранилища и токена. */
function logRedisError(step: string, error: unknown) {
  console.error("[rate-limit] redis error", {
    step,
    type: error instanceof Error ? error.name : typeof error,
    message: error instanceof RedisError ? error.message : undefined,
  });
}
