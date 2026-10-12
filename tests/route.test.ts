import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateResponse, ListingOutput } from "@/lib/listing-schema";
import { checkImage } from "@/lib/server/image";
import { __resetRateLimitsForTests, __trackedClientsForTests, acquireGeneration } from "@/lib/server/rate-limit";

const LISTING: ListingOutput = {
  title: "Bag",
  description: "A bag.",
  confirmed_specs: [],
  keywords: ["bag"],
  missing_details: [],
};

// Настоящий вызов Groq API в тестах не выполняется.
vi.mock("@/lib/server/groq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/groq")>();
  return { ...actual, generateListing: vi.fn() };
});

const { generateListing, ListingGenerationError } = await import("@/lib/server/groq");
const { POST } = await import("@/app/api/generate/route");
const generateMock = vi.mocked(generateListing);

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

function form(fields: Record<string, string>, photo?: File) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  if (photo) data.append("photo", photo);
  return data;
}

async function post(body: FormData | string, headers: Record<string, string> = {}) {
  const response = await POST(
    new Request("http://localhost/api/generate", { method: "POST", body, headers: { "x-forwarded-for": "10.0.0.1", ...headers } }),
  );
  return { status: response.status, headers: response.headers, json: (await response.json()) as GenerateResponse };
}

beforeEach(() => {
  __resetRateLimitsForTests();
  generateMock.mockReset();
  vi.stubEnv("GROQ_API_KEY", "test-key-not-real");
  vi.stubEnv("GENERATION_LIMIT_PER_HOUR", "2");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/generate", () => {
  it("возвращает объявление и не кэширует ответ", async () => {
    generateMock.mockResolvedValue(LISTING);
    const res = await post(form({ productName: "Сумка", condition: "used_good" }));
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, listing: LISTING, remainingToday: 4 });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ market: "global", productName: "Сумка", condition: "used_good" }),
      null,
    );
  });

  it("передаёт выбранный рынок в генерацию и отклоняет неизвестный", async () => {
    generateMock.mockResolvedValue(LISTING);
    expect((await post(form({ productName: "Сумка", market: "ru" }))).status).toBe(200);
    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ market: "ru" }), null);

    generateMock.mockClear();
    const bad = await post(form({ productName: "Сумка", market: "mars" }));
    expect(bad.status).toBe(400);
    expect(!bad.json.ok && Object.keys(bad.json.error.fields ?? {})).toEqual(["market"]);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("проверяет поля на сервере и не обращается к ИИ при ошибке", async () => {
    const res = await post(form({ productName: " ", condition: "hacked" }));
    expect(res.status).toBe(400);
    expect(res.json.ok).toBe(false);
    if (!res.json.ok) {
      expect(res.json.error.code).toBe("validation_error");
      expect(Object.keys(res.json.error.fields ?? {})).toEqual(expect.arrayContaining(["productName", "condition"]));
    }
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("без ключа объясняет настройку и не тратит лимит", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    for (let i = 0; i < 3; i++) {
      const res = await post(form({ productName: "Сумка" }));
      expect(res.status).toBe(503);
      expect(!res.json.ok && res.json.error.code).toBe("missing_api_key");
    }
    vi.stubEnv("GROQ_API_KEY", "test-key-not-real");
    generateMock.mockResolvedValue(LISTING);
    expect((await post(form({ productName: "Сумка" }))).status).toBe(200);
  });

  it("отклоняет файл, который выдаёт себя за картинку", async () => {
    const fake = new File([new TextEncoder().encode("<html>not an image</html>")], "x.jpg", { type: "image/jpeg" });
    const res = await post(form({ productName: "Сумка" }, fake));
    expect(res.status).toBe(400);
    expect(!res.json.ok && res.json.error.code).toBe("image_invalid");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("передаёт настоящее фото в генерацию с типом по сигнатуре", async () => {
    generateMock.mockResolvedValue(LISTING);
    const png = new File([PNG], "photo.jpg", { type: "image/png" });
    expect((await post(form({ productName: "Сумка" }, png))).status).toBe(200);
    expect(generateMock.mock.calls[0]?.[1]).toEqual({ mediaType: "image/png", base64: Buffer.from(PNG).toString("base64") });
  });

  it("отклоняет слишком большое тело запроса, даже без content-length", async () => {
    const big = new File([new Uint8Array(4 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    const body = form({ productName: "Сумка" }, big);
    // Передаём тело потоком — так у запроса нет заголовка content-length.
    const encoded = new Response(body);
    const stream = encoded.body!;
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        body: stream,
        headers: { "content-type": encoded.headers.get("content-type")! },
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("отклоняет запросы не в формате multipart", async () => {
    const res = await post(JSON.stringify({ productName: "Сумка" }), { "content-type": "application/json" });
    expect(res.status).toBe(415);
  });

  it("ограничивает частоту и возвращает Retry-After", async () => {
    generateMock.mockResolvedValue(LISTING);
    expect((await post(form({ productName: "Сумка" }))).status).toBe(200);
    expect((await post(form({ productName: "Сумка" }))).status).toBe(200);
    const res = await post(form({ productName: "Сумка" }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(generateMock).toHaveBeenCalledTimes(2);
  });

  it("возвращает попытку при неоплаченной ошибке ИИ, но не при тайм-ауте", async () => {
    generateMock.mockRejectedValue(new ListingGenerationError("ai_overloaded", "Перегрузка", 503, true));
    for (let i = 0; i < 3; i++) expect((await post(form({ productName: "Сумка" }))).status).toBe(503);

    generateMock.mockRejectedValue(new ListingGenerationError("ai_timeout", "Долго", 504, false));
    expect((await post(form({ productName: "Сумка" }))).status).toBe(504);
    expect((await post(form({ productName: "Сумка" }))).status).toBe(504);
    expect((await post(form({ productName: "Сумка" }))).status).toBe(429);
  });

  it("сообщает остаток бесплатной квоты и не списывает неудачные попытки", async () => {
    vi.stubEnv("GENERATION_LIMIT_PER_HOUR", "100");
    vi.stubEnv("GENERATION_LIMIT_PER_DAY", "3");
    generateMock.mockResolvedValue(LISTING);
    const first = await post(form({ productName: "Сумка" }));
    expect(first.json.ok && first.json.remainingToday).toBe(2);

    generateMock.mockRejectedValueOnce(new ListingGenerationError("ai_overloaded", "Перегрузка", 503, true));
    const refunded = await post(form({ productName: "Сумка" }));
    expect(refunded.status).toBe(503);
    expect(refunded.json.remainingToday).toBe(2);

    const second = await post(form({ productName: "Сумка" }));
    expect(second.json.ok && second.json.remainingToday).toBe(1);
    const third = await post(form({ productName: "Сумка" }));
    expect(third.json.ok && third.json.remainingToday).toBe(0);

    const limited = await post(form({ productName: "Сумка" }));
    expect(limited.status).toBe(429);
    expect(!limited.json.ok && limited.json.error.message).toContain("3 объявления за 24 часа");
    expect(limited.json.remainingToday).toBe(0);
  });

  it("не раскрывает детали внутренней ошибки", async () => {
    generateMock.mockRejectedValue(new Error("secret internal detail"));
    const res = await post(form({ productName: "Сумка" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.json)).not.toContain("secret internal detail");
  });
});

describe("POST /api/generate: Turnstile и общее хранилище", () => {
  function stubSiteverify(result: object | Error) {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("secret")).toBe("test-secret");
      if (result instanceof Error) throw result;
      return Response.json(result);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  beforeEach(() => vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret"));
  afterEach(() => vi.unstubAllGlobals());

  it("без токена не обращается к ИИ и не тратит лимит", async () => {
    const fetchMock = stubSiteverify({ success: true });
    for (let i = 0; i < 3; i++) {
      const res = await post(form({ productName: "Сумка" }));
      expect(res.status).toBe(403);
      expect(!res.json.ok && res.json.error.code).toBe("captcha_failed");
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("пропускает запрос с подтверждённым токеном", async () => {
    const fetchMock = stubSiteverify({ success: true });
    generateMock.mockResolvedValue(LISTING);
    const res = await post(form({ productName: "Сумка", "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX" }));
    expect(res.status).toBe(200);
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.get("response")).toBe("XXXX.DUMMY.TOKEN.XXXX");
    expect(body.get("remoteip")).toBe("10.0.0.1");
  });

  it("отклоняет неподтверждённый токен", async () => {
    stubSiteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
    const res = await post(form({ productName: "Сумка", "cf-turnstile-response": "used-token" }));
    expect(res.status).toBe(403);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("если Cloudflare недоступен, отвечает 503 и не обращается к ИИ", async () => {
    stubSiteverify(new Error("network down"));
    const res = await post(form({ productName: "Сумка", "cf-turnstile-response": "token" }));
    expect(res.status).toBe(503);
    expect(!res.json.ok && res.json.error.code).toBe("service_unavailable");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("если Redis недоступен, отвечает 503 и не обращается к ИИ", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 500 })));
    const res = await post(form({ productName: "Сумка" }));
    expect(res.status).toBe(503);
    expect(!res.json.ok && res.json.error.code).toBe("service_unavailable");
    expect(generateMock).not.toHaveBeenCalled();
  });
});

describe("checkImage", () => {
  it("принимает JPEG и отклоняет пустые, большие и неподдерживаемые файлы", async () => {
    expect((await checkImage(new File([JPEG], "a.jpg", { type: "image/jpeg" }))).ok).toBe(true);
    expect((await checkImage(new File([], "a.jpg", { type: "image/jpeg" }))).ok).toBe(false);
    expect((await checkImage(new File([JPEG], "a.gif", { type: "image/gif" }))).ok).toBe(false);
    const big = new Uint8Array(4 * 1024 * 1024);
    big.set(JPEG);
    const result = await checkImage(new File([big], "a.jpg", { type: "image/jpeg" }));
    expect(result.ok).toBe(false);
  });
});

describe("rate limiter", () => {
  it("не допускает параллельных генераций одного клиента", () => {
    const first = acquireGeneration("a");
    expect(first.ok).toBe(true);
    const second = acquireGeneration("a");
    expect(second.ok === false && second.reason).toBe("busy");
    if (first.ok) first.release();
    expect(acquireGeneration("a").ok).toBe(true);
  });

  it("отклонённые запросы не занимают память, общий лимит действует для всех", () => {
    vi.stubEnv("GENERATION_LIMIT_GLOBAL_PER_DAY", "1");
    const first = acquireGeneration("a");
    if (first.ok) first.release();
    for (let i = 0; i < 100; i++) expect(acquireGeneration(`ip-${i}`).ok).toBe(false);
    expect(__trackedClientsForTests()).toEqual({ hour: 1, day: 1 });
  });

  it("окно сбрасывается по времени", () => {
    const now = 1_000_000;
    for (let i = 0; i < 2; i++) {
      const r = acquireGeneration("a", now);
      if (r.ok) r.release();
    }
    expect(acquireGeneration("a", now).ok).toBe(false);
    expect(acquireGeneration("a", now + 60 * 60 * 1000 + 1).ok).toBe(true);
  });
});
