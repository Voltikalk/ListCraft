import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingOutput } from "@/lib/listing-schema";
import { ListingGenerationError, mapApiError, parseModelResponse, sanitizeListing } from "@/lib/server/claude";

type Response = Parameters<typeof parseModelResponse>[0];

const VALID: ListingOutput = {
  title: "Brown Leather Crossbody Bag",
  description: "A compact crossbody bag.\n\nAdjustable strap.",
  confirmed_specs: [{ name: "Color", value: "Brown", source: "seller" }],
  keywords: ["crossbody bag", "leather bag"],
  missing_details: ["Укажите размеры сумки."],
};

function textResponse(text: string, stop_reason: Response["stop_reason"] = "end_turn"): Response {
  return { stop_reason, content: [{ type: "text", text, citations: null }] } as Response;
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

  it("обрабатывает отказ модели и обрезанный ответ", () => {
    const refused = expectGenerationError(() => parseModelResponse(textResponse("", "refusal")), "ai_refused");
    expect(refused.refundable).toBe(false);
    expectGenerationError(() => parseModelResponse(textResponse('{"title":', "max_tokens")), "ai_invalid_output");
  });

  it("при серверном fallback берёт только ответ последней модели", () => {
    const response = {
      stop_reason: "end_turn",
      content: [
        { type: "text", text: '{"title":"partial', citations: null },
        { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-sonnet-5-5" } },
        { type: "text", text: JSON.stringify(VALID), citations: null },
      ],
    } as unknown as Response;
    expect(parseModelResponse(response)).toEqual(VALID);
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

  const apiError = (status: number, type: string, message = "error") =>
    Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, message, new Headers());

  const cases: [string, unknown, string, number, boolean][] = [
    ["401", apiError(401, "authentication_error"), "invalid_api_key", 503, true],
    ["403", apiError(403, "permission_error"), "invalid_api_key", 503, true],
    ["404", apiError(404, "not_found_error"), "model_not_found", 503, true],
    ["429", apiError(429, "rate_limit_error"), "ai_overloaded", 503, true],
    ["529", apiError(529, "overloaded_error"), "ai_overloaded", 503, true],
    ["500", apiError(500, "api_error"), "ai_overloaded", 503, false],
    ["400 image", apiError(400, "invalid_request_error", "Could not process image"), "image_invalid", 400, true],
    ["400 other", apiError(400, "invalid_request_error", "messages: bad"), "ai_error", 502, true],
    ["timeout", new Anthropic.APIConnectionTimeoutError(), "ai_timeout", 504, false],
    ["connection", new Anthropic.APIConnectionError({ message: "ECONNRESET" }), "ai_error", 502, false],
    ["unknown", new TypeError("boom"), "ai_error", 502, false],
  ];

  it.each(cases)("%s → правильный код, статус и возврат попытки", (_name, error, code, status, refundable) => {
    const mapped = mapApiError(error, "claude-opus-5-5");
    expect(mapped.code).toBe(code);
    expect(mapped.httpStatus).toBe(status);
    expect(mapped.refundable).toBe(refundable);
    expect(mapped.userMessage).toMatch(/[а-яё]/i);
  });

  it("в production не показывает посетителю подсказки по настройке сервера", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      for (const error of [
        apiError(401, "authentication_error"),
        apiError(404, "not_found_error"),
        apiError(400, "invalid_request_error", "Your credit balance is too low"),
        apiError(400, "invalid_request_error", "messages: bad"),
      ]) {
        const message = mapApiError(error, "claude-opus-5-5").userMessage;
        expect(message).not.toMatch(/ANTHROPIC_|Anthropic Console|аккаунт/);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
