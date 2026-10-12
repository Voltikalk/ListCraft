import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reserveGeneration } from "@/lib/server/shared-rate-limit";

/** Упрощённый Redis в памяти: только команды, которые использует лимитер, и REST /pipeline Upstash. */
function createFakeRedis() {
  const data = new Map<string, { value: string; expiresAt: number | null }>();
  let now = 1_000_000;
  let requestIndex = 0;
  const failing = new Set<number>();
  const requests: string[][][] = [];

  const get = (key: string) => {
    const entry = data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now) {
      data.delete(key);
      return undefined;
    }
    return entry;
  };

  function run([name, key, ...args]: string[]): unknown {
    switch (name) {
      case "SET": {
        const nx = args.includes("NX");
        const px = args.indexOf("PX");
        if (nx && get(key)) return null;
        data.set(key, { value: args[0], expiresAt: px >= 0 ? now + Number(args[px + 1]) : null });
        return "OK";
      }
      case "INCR":
      case "DECR": {
        const entry = get(key) ?? { value: "0", expiresAt: null };
        entry.value = String(Number(entry.value) + (name === "INCR" ? 1 : -1));
        data.set(key, entry);
        return Number(entry.value);
      }
      case "PTTL": {
        const entry = get(key);
        if (!entry) return -2;
        return entry.expiresAt === null ? -1 : entry.expiresAt - now;
      }
      case "PEXPIRE": {
        const entry = get(key);
        if (!entry) return 0;
        entry.expiresAt = now + Number(args[0]);
        return 1;
      }
      case "DEL":
        return data.delete(key) ? 1 : 0;
      default:
        throw new Error(`unsupported command ${name}`);
    }
  }

  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe("https://redis.test/pipeline");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    if (failing.has(requestIndex++)) return new Response("error", { status: 500 });
    const commands = JSON.parse(String(init?.body)) as string[][];
    requests.push(commands);
    return Response.json(commands.map((command) => ({ result: run(command) })));
  });

  return {
    fetchMock,
    data,
    requests,
    advance: (ms: number) => (now += ms),
    /** Ошибка на запросе с номером offset, считая от следующего (0 — следующий). */
    failRequest: (offset = 0) => failing.add(requestIndex + offset),
  };
}

let redis: ReturnType<typeof createFakeRedis>;

beforeEach(() => {
  redis = createFakeRedis();
  vi.stubGlobal("fetch", redis.fetchMock);
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test/");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  vi.stubEnv("GENERATION_LIMIT_PER_HOUR", "2");
  vi.stubEnv("GENERATION_LIMIT_PER_DAY", "3");
  vi.stubEnv("GENERATION_LIMIT_GLOBAL_PER_DAY", "100");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function generateOnce(client: string) {
  const result = await reserveGeneration(client);
  if (result.ok) await result.release();
  return result;
}

describe("лимиты в Redis", () => {
  it("не хранит IP-адрес в ключах", async () => {
    await generateOnce("203.0.113.7");
    const keys = [...redis.data.keys()];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.startsWith("listcraft:rl:")).toBe(true);
      expect(key).not.toContain("203.0.113.7");
    }
    expect(JSON.stringify(redis.requests)).not.toContain("203.0.113.7");
  });

  it("не допускает параллельных генераций одного клиента", async () => {
    const first = await reserveGeneration("a");
    expect(first.ok).toBe(true);
    const second = await reserveGeneration("a");
    expect(second.ok === false && second.reason).toBe("busy");
    expect((await reserveGeneration("b")).ok).toBe(true);
    if (first.ok) await first.release();
    expect((await reserveGeneration("a")).ok).toBe(true);
  });

  it("блокировка истекает сама, если release() не был вызван", async () => {
    expect((await reserveGeneration("a")).ok).toBe(true);
    redis.advance(131_000);
    expect((await reserveGeneration("a")).ok).toBe(true);
  });

  it("часовой лимит, затем окно сбрасывается", async () => {
    expect((await generateOnce("a")).ok).toBe(true);
    expect((await generateOnce("a")).ok).toBe(true);
    const limited = await generateOnce("a");
    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      expect(limited.reason).toBe("rate_limited");
      expect(limited.remainingToday).toBe(1);
      expect(limited.retryAfterSeconds).toBeGreaterThan(0);
    }
    redis.advance(60 * 60 * 1000 + 1);
    const third = await generateOnce("a");
    expect(third.ok && third.remainingToday()).toBe(0);
  });

  it("суточная квота и счётчик остатка", async () => {
    vi.stubEnv("GENERATION_LIMIT_PER_HOUR", "100");
    const remaining: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await generateOnce("a");
      if (r.ok) remaining.push(r.remainingToday());
    }
    expect(remaining).toEqual([2, 1, 0]);
    const limited = await generateOnce("a");
    expect(limited.ok === false && limited.remainingToday).toBe(0);
    expect(limited.ok === false && limited.message).toContain("3 объявления за 24 часа");
    // Отказ не увеличивает счётчик: после суток квота снова полная.
    redis.advance(24 * 60 * 60 * 1000 + 1);
    expect((await generateOnce("a")).ok).toBe(true);
  });

  it("общий суточный лимит действует для всех клиентов", async () => {
    vi.stubEnv("GENERATION_LIMIT_GLOBAL_PER_DAY", "2");
    expect((await generateOnce("a")).ok).toBe(true);
    expect((await generateOnce("b")).ok).toBe(true);
    const limited = await generateOnce("c");
    expect(limited.ok === false && limited.message).toContain("общий лимит");
  });

  it("refund() возвращает попытку", async () => {
    vi.stubEnv("GENERATION_LIMIT_PER_HOUR", "100");
    const r = await reserveGeneration("a");
    expect(r.ok && r.remainingToday()).toBe(2);
    if (r.ok) {
      await r.refund();
      await r.refund(); // повторный вызов ничего не меняет
      expect(r.remainingToday()).toBe(3);
      await r.release();
    }
    for (let i = 0; i < 3; i++) expect((await generateOnce("a")).ok).toBe(true);
    expect((await generateOnce("a")).ok).toBe(false);
  });

  it("чинит счётчик без срока жизни", async () => {
    await generateOnce("a");
    const dayKey = [...redis.data.keys()].find((key) => key.includes(":day:"))!;
    redis.data.get(dayKey)!.expiresAt = null;
    await generateOnce("a");
    expect(redis.data.get(dayKey)!.expiresAt).not.toBeNull();
  });

  it("при недоступном Redis не разрешает генерацию и снимает блокировку", async () => {
    redis.failRequest();
    const first = await reserveGeneration("a");
    expect(first.ok === false && first.reason).toBe("unavailable");

    // Блокировка поставлена, а счётчики не прочитаны — блокировка должна быть снята.
    redis.failRequest(1);
    const second = await reserveGeneration("a");
    expect(second.ok === false && second.reason).toBe("unavailable");
    expect([...redis.data.keys()].some((key) => key.includes(":lock:"))).toBe(false);
    expect((await reserveGeneration("a")).ok).toBe(true);
  });

  it("без Redis использует счётчик в памяти", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const r = await reserveGeneration("memory-client");
    expect(r.ok).toBe(true);
    if (r.ok) await r.release();
    expect(redis.fetchMock).not.toHaveBeenCalled();
  });
});
