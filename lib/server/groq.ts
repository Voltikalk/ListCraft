import { z } from "zod";
import {
  listingOutputSchema,
  type AllowedImageType,
  type GenerateErrorCode,
  type ListingInput,
  type ListingOutput,
} from "@/lib/listing-schema";
import { SYSTEM_PROMPTS, buildUserPrompt } from "./prompt";

/** OpenAI-совместимый эндпоинт Groq: https://console.groq.com/docs/openai */
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
/** Мультимодальная модель (текст + фото), поддерживает JSON Schema в режиме best-effort. */
const DEFAULT_MODEL = "qwen/qwen3.8-27b";

/** Укладывается в maxDuration маршрута (120 с) с запасом на чтение формы и ответ. */
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 8000;

/**
 * JSON-схема ответа для response_format. У qwen/qwen3.8-27b нет строгого режима (strict),
 * поэтому соответствие схеме не гарантировано — ответ всё равно проверяется Zod ниже.
 */
const LISTING_JSON_SCHEMA: Record<string, unknown> = z.toJSONSchema(listingOutputSchema);
delete LISTING_JSON_SCHEMA.$schema;

export class ListingGenerationError extends Error {
  constructor(
    public readonly code: GenerateErrorCode,
    public readonly userMessage: string,
    public readonly httpStatus: number,
    /**
     * true — запрос к ИИ заведомо не был выполнен и оплачен (ошибка авторизации,
     * перегрузка, ошибка сервера Groq — их Groq не тарифицирует, отклонённый запрос),
     * поэтому попытку можно вернуть в лимит. Тайм-ауты и обрывы связи НЕ возвращаются:
     * модель могла успеть сгенерировать (и списать) ответ.
     */
    public readonly refundable: boolean = false,
  ) {
    super(code);
  }
}

/** Ошибка, которую вернул Groq API (HTTP-статус не 2xx). */
export class GroqApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly type: string | undefined,
    public readonly errorCode: string | undefined,
    message: string,
    public readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "GroqApiError";
  }
}

export function getApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key ? key : null;
}

export function getModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
}

export type ListingImage = { mediaType: AllowedImageType; base64: string };

/** Нужная нам часть ответа chat/completions. */
export type ChatCompletion = {
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | null; refusal?: string | null };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export async function generateListing(input: ListingInput, image: ListingImage | null): Promise<ListingOutput> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ListingGenerationError(
      "missing_api_key",
      setupMessage("Генерация через ИИ не настроена: на сервере не задан GROQ_API_KEY."),
      503,
      true,
    );
  }

  const model = getModel();
  const content: Record<string, unknown>[] = [];
  if (image) {
    content.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.base64}` } });
  }
  content.push({ type: "text", text: buildUserPrompt(input, image !== null) });

  const startedAt = Date.now();
  let completion: ChatCompletion;
  try {
    // Без автоматических повторов: повтор после тайм-аута может стоить двух оплаченных
    // генераций на одно нажатие. Пользователь повторит сам (попытка вернётся в лимит).
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[input.market] },
          { role: "user", content },
        ],
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        // Режим без рассуждений (instruct): для объявления он быстрее и дешевле.
        // Температура и top_p — рекомендованные Groq значения для этого режима.
        reasoning_effort: "none",
        temperature: 0.7,
        top_p: 0.8,
        response_format: {
          type: "json_schema",
          json_schema: { name: "listing", schema: LISTING_JSON_SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw await toApiError(response);
    completion = (await response.json()) as ChatCompletion;
  } catch (error) {
    throw mapApiError(error, model);
  }

  // Логируем только технические метаданные — без текста пользователя, изображений и ключей.
  console.info("[generate] model response", {
    model,
    finish_reason: completion.choices?.[0]?.finish_reason ?? null,
    input_tokens: completion.usage?.prompt_tokens,
    output_tokens: completion.usage?.completion_tokens,
    market: input.market,
    has_image: image !== null,
    ms: Date.now() - startedAt,
  });

  return parseModelResponse(completion);
}

/** Читает тело ошибки Groq: {"error": {"message", "type", "code"}}. */
async function toApiError(response: Response): Promise<GroqApiError> {
  let error: { message?: unknown; type?: unknown; code?: unknown } = {};
  try {
    const body = (await response.json()) as { error?: typeof error };
    if (body?.error && typeof body.error === "object") error = body.error;
  } catch {
    // Тело не JSON — достаточно статуса.
  }
  return new GroqApiError(
    response.status,
    typeof error.type === "string" ? error.type : undefined,
    typeof error.code === "string" ? error.code : undefined,
    typeof error.message === "string" ? error.message : `HTTP ${response.status}`,
    response.headers.get("x-request-id"),
  );
}

/**
 * Разбирает и проверяет ответ модели. Вынесено отдельно, чтобы покрыть тестами
 * без обращения к API.
 */
export function parseModelResponse(completion: ChatCompletion): ListingOutput {
  const choice = completion.choices?.[0];
  if (!choice?.message) throw invalidOutput();

  if (choice.message.refusal || choice.finish_reason === "content_filter") {
    throw new ListingGenerationError(
      "ai_refused",
      "ИИ отказался обрабатывать этот запрос. Проверьте, что описан обычный товар, и попробуйте переформулировать.",
      422,
    );
  }
  if (choice.finish_reason === "length") {
    throw new ListingGenerationError(
      "ai_invalid_output",
      "Ответ ИИ оказался слишком длинным и был обрезан. Попробуйте сократить описание.",
      502,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(extractJson(choice.message.content ?? ""));
  } catch {
    throw invalidOutput();
  }
  const parsed = listingOutputSchema.safeParse(normalizeSpecSources(json));
  if (!parsed.success) throw invalidOutput();

  return sanitizeListing(parsed.data);
}

/**
 * Схема в режиме best-effort не гарантирует «чистый» JSON: на всякий случай убираем
 * блок рассуждений <think>…</think> и обёртку ```json … ```.
 */
function extractJson(text: string): string {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(stripped);
  return fenced ? fenced[1] : stripped;
}

function invalidOutput() {
  return new ListingGenerationError(
    "ai_invalid_output",
    "ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.",
    502,
  );
}

/**
 * Значение enum поля source модель может нарушить (схема не строгая).
 * Неизвестный источник считаем «photo» — интерфейс попросит продавца проверить такую
 * характеристику — вместо отказа от всего ответа.
 */
function normalizeSpecSources(json: unknown): unknown {
  if (!json || typeof json !== "object" || !Array.isArray((json as { confirmed_specs?: unknown }).confirmed_specs)) {
    return json;
  }
  const specs = (json as { confirmed_specs: unknown[] }).confirmed_specs.map((spec) => {
    if (!spec || typeof spec !== "object") return spec;
    const source = String((spec as { source?: unknown }).source ?? "").trim().toLowerCase();
    return { ...spec, source: source === "seller" ? "seller" : "photo" };
  });
  return { ...json, confirmed_specs: specs };
}

const MAX_SPECS = 20;
const MAX_KEYWORDS = 20;
const MAX_MISSING = 8;

/** Убирает управляющие символы и лишние пробелы, сохраняя переносы строк. */
function clean(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Финальная проверка ответа модели перед отправкой во frontend. */
export function sanitizeListing(raw: ListingOutput): ListingOutput {
  const title = clean(raw.title).replace(/\s+/g, " ");
  const description = clean(raw.description);
  if (!title || !description) throw invalidOutput();

  const seenSpecs = new Set<string>();
  const confirmed_specs = raw.confirmed_specs
    .map((s) => ({ name: clean(s.name).replace(/\s+/g, " "), value: clean(s.value).replace(/\s+/g, " "), source: s.source }))
    .filter((s) => {
      const key = s.name.toLowerCase();
      if (!s.name || !s.value || seenSpecs.has(key)) return false;
      seenSpecs.add(key);
      return true;
    })
    .slice(0, MAX_SPECS);

  const seenKeywords = new Set<string>();
  const keywords = raw.keywords
    .map((k) => clean(k).replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase())
    .filter((k) => {
      if (!k || seenKeywords.has(k)) return false;
      seenKeywords.add(k);
      return true;
    })
    .slice(0, MAX_KEYWORDS);

  const missing_details = raw.missing_details
    .map((m) => clean(m).replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, MAX_MISSING);

  return { title, description, confirmed_specs, keywords, missing_details };
}

/**
 * Подсказки по настройке сервера (ключ, модель, баланс) нужны только разработчику.
 * В продакшене посетитель видит нейтральный текст, а подробности остаются в журнале сервера.
 */
export function setupMessage(devMessage: string): string {
  return process.env.NODE_ENV === "production" ? "Сервис временно недоступен. Попробуйте позже." : devMessage;
}

/** Переводит ошибку запроса к Groq в понятное пользователю сообщение. Экспортируется для тестов. */
export function mapApiError(error: unknown, model: string): ListingGenerationError {
  if (error instanceof GroqApiError) {
    // В сообщениях об ошибках API нет пользовательских данных; ключ в них не попадает.
    // Поле failed_generation (текст неудачного ответа) не читаем и не логируем.
    console.error("[generate] Groq API error", {
      status: error.status,
      type: error.type,
      code: error.errorCode,
      request_id: error.requestId,
      message: error.message.slice(0, 300),
    });
  } else {
    console.error("[generate] unexpected error", { type: error instanceof Error ? error.name : typeof error });
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return new ListingGenerationError(
      "ai_timeout",
      "ИИ отвечал слишком долго. Попробуйте ещё раз через минуту или сократите описание.",
      504,
    );
  }
  if (!(error instanceof GroqApiError)) {
    return new ListingGenerationError(
      "ai_error",
      "Сервер не смог связаться с сервисом ИИ. Попробуйте снова через минуту.",
      502,
    );
  }

  const { status } = error;
  const message = error.message.toLowerCase();

  if (status === 401 || status === 403) {
    return new ListingGenerationError(
      "invalid_api_key",
      setupMessage("Сервер не смог авторизоваться в Groq API. Проверьте значение GROQ_API_KEY и права ключа."),
      503,
      true,
    );
  }
  if (status === 404 || error.errorCode === "model_not_found" || error.errorCode === "model_decommissioned") {
    return new ListingGenerationError(
      "model_not_found",
      setupMessage(`Модель «${model}» недоступна. Проверьте значение GROQ_MODEL.`),
      503,
      true,
    );
  }
  if (status === 429 || status === 498 || status === 503) {
    return new ListingGenerationError(
      "ai_overloaded",
      "Сервис ИИ сейчас перегружен. Подождите минуту и попробуйте снова.",
      503,
      true,
    );
  }
  if (status >= 500) {
    return new ListingGenerationError(
      "ai_overloaded",
      "Сервис ИИ временно недоступен. Подождите минуту и попробуйте снова.",
      503,
      true,
    );
  }
  if (status === 413) {
    return new ListingGenerationError(
      "image_invalid",
      "Фото слишком большое для сервиса ИИ. Выберите изображение поменьше или создайте объявление без фото.",
      400,
      true,
    );
  }
  // Модель не смогла выдать JSON по схеме (или ответ не прошёл проверку Groq) — токены уже потрачены.
  if (status === 422 || error.errorCode === "json_validate_failed") {
    return invalidOutput();
  }
  if (status === 400 && message.includes("image")) {
    return new ListingGenerationError(
      "image_invalid",
      "Сервис ИИ не смог обработать фото. Попробуйте другое изображение или создайте объявление без фото.",
      400,
      true,
    );
  }
  if (status >= 400 && status < 500) {
    return new ListingGenerationError(
      "ai_error",
      process.env.NODE_ENV === "production"
        ? "Сервис ИИ отклонил запрос. Попробуйте изменить описание."
        : "Сервис ИИ отклонил запрос. Попробуйте изменить описание. Если ошибка повторяется, проверьте настройки аккаунта Groq.",
      502,
      true,
    );
  }
  return new ListingGenerationError(
    "ai_error",
    "Сервер не смог связаться с сервисом ИИ. Попробуйте снова через минуту.",
    502,
  );
}
