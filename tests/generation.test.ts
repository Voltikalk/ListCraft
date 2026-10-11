import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingInput, ListingOutput } from "@/lib/listing-schema";
import {
  generateListing,
  GroqApiError,
  ListingGenerationError,
  mapApiError,
  parseModelResponse,
  sanitizeListing,
  type ChatCompletion,
} from "@/lib/server/groq";

const VALID: ListingOutput = {
  title: "Brown Leather Crossbody Bag",
  description: "A compact crossbody bag.\n\nAdjustable strap.",
  confirmed_specs: [{ name: "Color", value: "Brown", source: "seller" }],
  keywords: ["crossbody bag", "leather bag"],
  missing_details: ["Укажите размеры сумки."],
};

function textResponse(content: string | null, finish_reason = "stop", refusal: string | null = null): ChatCompletion {
  return { choices: [{ finish_reason, message: { content, refusal } }] };
}

function expectGenerationError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ListingGenerationError);
    expect((error as ListingGenerationError).code).toBe(code);
    return error as ListingGenerationError;
  }
  throw new Error(`ожидалась ошибка ${code}`);
}

describe("parseModelResponse", () => {
  it("возвращает проверенное объявление", () => {
    expect(parseModelResponse(textResponse(JSON.stringify(VALID)))).toEqual(VALID);
  });

  it("отклоняет не-JSON и JSON неверной структуры", () => {
    expectGenerationError(() => parseModelResponse(textResponse("Sure! Here is your listing")), "ai_invalid_output");
    expectGenerationError(
      () => parseModelResponse(textResponse(JSON.stringify({ ...VALID, keywords: "bag" }))),
      "ai_invalid_output",
    );
    expectGenerationError(
      () => parseModelResponse(textResponse(JSON.stringify({ title: "Only title" }))),
      "ai_invalid_output",
    );
  });

  it("обрабатывает отказ модели, обрезанный и пустой ответ", () => {
    const refused = expectGenerationError(() => parseModelResponse(textResponse(null, "stop", "I can't help")), "ai_refused");
    expect(refused.refundable).toBe(false);
    expectGenerationError(() => parseModelResponse(textResponse("", "content_filter")), "ai_refused");
    expectGenerationError(() => parseModelResponse(textResponse('{"title":', "length")), "ai_invalid_output");
    expectGenerationError(() => parseModelResponse(textResponse(null)), "ai_invalid_output");
    expectGenerationError(() => parseModelResponse({ choices: [] }), "ai_invalid_output");
  });

  it("убирает блок рассуждений и обёртку ```json", () => {
    const text = "<think>reasoning</think>\n```json\n" + JSON.stringify(VALID) + "\n```";
    expect(parseModelResponse(textResponse(text))).toEqual(VALID);
  });

  it("неизвестный источник характеристики считает «photo», а не отбрасывает ответ", () => {
    const json = { ...VALID, confirmed_specs: [{ name: "Pattern", value: "Striped", source: "image" }] };
    expect(parseModelResponse(textResponse(JSON.stringify(json))).confirmed_specs).toEqual([
      { name: "Pattern", value: "Striped", source: "photo" },
    ]);
  });
});

describe("sanitizeListing", () => {
  it("чистит управляющие символы, пробелы, дубли и решётки", () => {
    const result = sanitizeListing({
      title: "  Brown \u0007 Bag  ",
      description: "Line one  \r\n\r\n\r\n\r\nLine two",
      confirmed_specs: [
        { name: "Color", value: "Brown", source: "seller" },
        { name: "color", value: "Dark brown", source: "photo" },
        { name: "Size", value: "  ", source: "seller" },
      ],
      keywords: ["#Bag", "bag", " Leather  Bag "],
      missing_details: ["  ", "Укажите размер."],
    });
    expect(result).toEqual({
      title: "Brown Bag",
      description: "Line one\n\nLine two",
      confirmed_specs: [{ name: "Color", value: "Brown", source: "seller" }],
      keywords: ["bag", "leather bag"],
      missing_details: ["Укажите размер."],
    });
  });

  it("отклоняет ответ без заголовка или описания", () => {
    expectGenerationError(() => sanitizeListing({ ...VALID, title: " \n " }), "ai_invalid_output");
    expectGenerationError(() => sanitizeListing({ ...VALID, description: "" }), "ai_invalid_output");
  });

  it("ограничивает длину списков", () => {
    const keywords = Array.from({ length: 40 }, (_, i) => `kw ${i}`);
    expect(sanitizeListing({ ...VALID, keywords }).keywords).toHaveLength(20);
  });
});

describe("mapApiError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const apiError = (status: number, message = "error", code?: string) =>
    new GroqApiError(status, "invalid_request_error", code, message);

  const cases: [string, unknown, string, number, boolean][] = [
    ["401", apiError(401, "Invalid API Key", "invalid_api_key"), "invalid_api_key", 503, true],
    ["403", apiError(403), "invalid_api_key", 503, true],
    ["404", apiError(404, "model does not exist", "model_not_found"), "model_not_found", 503, true],
    ["400 decommissioned", apiError(400, "model decommissioned", "model_decommissioned"), "model_not_found", 503, true],
    ["429", apiError(429, "Rate limit reached"), "ai_overloaded", 503, true],
    ["498", apiError(498), "ai_overloaded", 503, true],
    ["503", apiError(503), "ai_overloaded", 503, true],
    ["500", apiError(500), "ai_overloaded", 503, true],
    ["413", apiError(413), "image_invalid", 400, true],
    ["400 json", apiError(400, "Failed to generate JSON", "json_validate_failed"), "ai_invalid_output", 502, false],
    ["422", apiError(422), "ai_invalid_output", 502, false],
    ["400 image", apiError(400, "Could not process image"), "image_invalid", 400, true],
    ["400 other", apiError(400, "messages: bad"), "ai_error", 502, true],
    ["timeout", new DOMException("The operation timed out.", "TimeoutError"), "ai_timeout", 504, false],
    ["connection", new TypeError("fetch failed"), "ai_error", 502, false],
  ];

  it.each(cases)("%s → правильный код, статус и возврат попытки", (_name, error, code, status, refundable) => {
    const mapped = mapApiError(error, "qwen/qwen3.8-27b");
    expect(mapped.code).toBe(code);
    expect(mapped.httpStatus).toBe(status);
    expect(mapped.refundable).toBe(refundable);
    expect(mapped.userMessage).toMatch(/[а-яё]/i);
  });

  it("в production не показывает посетителю подсказки по настройке сервера", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      for (const error of [
        apiError(401),
        apiError(404, "model does not exist", "model_not_found"),
        apiError(400, "messages: bad"),
      ]) {
        const message = mapApiError(error, "qwen/qwen3.8-27b").userMessage;
        expect(message).not.toMatch(/GROQ_|Groq|аккаунт|qwen/);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("generateListing", () => {
  const INPUT: ListingInput = {
    market: "ru",
    productName: "Сумка",
    brand: "",
    condition: "",
    dimensions: "",
    color: "",
    material: "",
    details: "",
  };
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-key-not-real");
    vi.stubEnv("GROQ_MODEL", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("отправляет в Groq модель, схему ответа и фото; ключ — только в заголовке", async () => {
    fetchMock.mockResolvedValue(Response.json(textResponse(JSON.stringify(VALID))));
    const result = await generateListing(INPUT, { mediaType: "image/png", base64: "AAAA" });
    expect(result).toEqual(VALID);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key-not-real");
    const body = JSON.parse(String(init?.body));
    expect(JSON.stringify(body)).not.toContain("test-key-not-real");
    expect(body.model).toBe("qwen/qwen3.8-27b");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.required).toEqual(
      expect.arrayContaining(["title", "description", "confirmed_specs", "keywords", "missing_details"]),
    );
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content[0]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } });
    expect(body.messages[1].content[1].text).toContain("Сумка");
  });

  it("переводит HTTP-ошибку Groq в понятную ошибку", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { message: "Rate limit reached", type: "tokens", code: "rate_limit_exceeded" } }, { status: 429 }),
    );
    const error = await generateListing(INPUT, null).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ListingGenerationError);
    expect((error as ListingGenerationError).code).toBe("ai_overloaded");
    expect((error as ListingGenerationError).refundable).toBe(true);
  });

  it("без ключа не обращается к API", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const error = await generateListing(INPUT, null).catch((e: unknown) => e);
    expect((error as ListingGenerationError).code).toBe("missing_api_key");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
