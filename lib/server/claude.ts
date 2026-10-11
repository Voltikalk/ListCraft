import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  listingOutputSchema,
  type AllowedImageType,
  type GenerateErrorCode,
  type ListingInput,
  type ListingOutput,
} from "@/lib/listing-schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

const DEFAULT_MODEL = "claude-opus-5-5";

/** Модели, для которых поддерживается серверный fallback при отказе (refusal). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
/** Модели, принимающие output_config.effort. Для остальных параметр не отправляется. */
const EFFORT_MODEL_PATTERN = /^claude-(fable-5|mythos-5|opus-5|sonnet-5|haiku-5|opus-4-[5-8]|sonnet-4-6)/;

/** Укладывается в maxDuration маршрута (120 с) с запасом на чтение формы и ответ. */
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 8000;

export class ListingGenerationError extends Error {
  constructor(
    public readonly code: GenerateErrorCode,
    public readonly userMessage: string,
    public readonly httpStatus: number,
    /**
     * true — запрос к ИИ заведомо не был выполнен и оплачен (ошибка авторизации,
     * перегрузка 429/529, отклонённый запрос), поэтому попытку можно вернуть в лимит.
     * Тайм-ауты и обрывы связи НЕ возвращаются: модель могла успеть сгенерировать (и списать) ответ.
     */
    public readonly refundable: boolean = false,
  ) {
    super(code);
  }
}

export function getApiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? key : null;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

let cachedClient: { key: string; client: Anthropic } | null = null;

function getClient(apiKey: string): Anthropic {
  if (cachedClient?.key !== apiKey) {
    // Без автоматических повторов: SDK повторяет и при тайм-ауте, а это может стоить
    // двух оплаченных генераций на одно нажатие. Пользователь повторит сам (попытка вернётся в лимит).
    cachedClient = { key: apiKey, client: new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 }) };
  }
  return cachedClient.client;
}

export type ListingImage = { mediaType: AllowedImageType; base64: string };

export async function generateListing(input: ListingInput, image: ListingImage | null): Promise<ListingOutput> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ListingGenerationError(
      "missing_api_key",
      setupMessage("Генерация через ИИ не настроена: на сервере не задан ANTHROPIC_API_KEY."),
      503,
      true,
    );
  }

  const model = getModel();
  const client = getClient(apiKey);
  const useFallback = FALLBACK_MODELS.has(model);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) {
    content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } });
  }
  content.push({ type: "text", text: buildUserPrompt(input, image !== null) });

  const startedAt = Date.now();
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: {
        format: betaZodOutputFormat(listingOutputSchema),
        ...(EFFORT_MODEL_PATTERN.test(model) ? { effort: "low" as const } : {}),
      },
      // При отказе модели (refusal) API само повторит запрос на подходящей модели.
      ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  } catch (error) {
    throw mapApiError(error, model);
  }

  // Логируем только технические метаданные — без текста пользователя, изображений и ключей.
  console.info("[generate] model response", {
    model,
    stop_reason: response.stop_reason,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    has_image: image !== null,
    ms: Date.now() - startedAt,
  });

  return parseModelResponse(response);
}

type ModelResponse = Pick<Anthropic.Beta.BetaMessage, "content" | "stop_reason">;

/**
 * Разбирает и проверяет ответ модели. Вынесено отдельно, чтобы покрыть тестами
 * без обращения к API.
 */
export function parseModelResponse(response: ModelResponse): ListingOutput {
  if (response.stop_reason === "refusal") {
    throw new ListingGenerationError(
      "ai_refused",
      "ИИ отказался обрабатывать этот запрос. Проверьте, что описан обычный товар, и попробуйте переформулировать.",
      422,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new ListingGenerationError(
      "ai_invalid_output",
      "Ответ ИИ оказался слишком длинным и был обрезан. Попробуйте сократить описание.",
      502,
    );
  }

  // При серверном fallback в content может остаться частичный ответ отказавшей модели,
  // затем блок "fallback" и полный ответ следующей модели. Берём только последний.
  let start = 0;
  response.content.forEach((block, index) => {
    if (block.type === "fallback") start = index + 1;
  });
  const text = response.content
    .slice(start)
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw invalidOutput();
  }
  const parsed = listingOutputSchema.safeParse(normalizeSpecSources(json));
  if (!parsed.success) throw invalidOutput();

  return sanitizeListing(parsed.data);
}

function invalidOutput() {
  return new ListingGenerationError(
    "ai_invalid_output",
    "ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз.",
    502,
  );
}

/**
 * SDK передаёт enum поля source модели только как подсказку в описании схемы,
 * поэтому значение не гарантировано. Неизвестный источник считаем «photo» —
 * интерфейс попросит продавца проверить такую характеристику — вместо отказа от всего ответа.
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

/** Переводит ошибку SDK в понятное пользователю сообщение. Экспортируется для тестов. */
export function mapApiError(error: unknown, model: string): ListingGenerationError {
  if (error instanceof Anthropic.APIError) {
    // В сообщениях об ошибках API нет пользовательских данных; ключ в них не попадает.
    console.error("[generate] Anthropic API error", {
      status: error.status,
      type: error.type ?? error.name,
      request_id: error.requestID,
      message: error.message.slice(0, 300),
    });
  } else {
    console.error("[generate] unexpected error", { type: error instanceof Error ? error.name : typeof error });
  }

  // Порядок важен: APIConnectionTimeoutError — подкласс APIConnectionError.
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ListingGenerationError(
      "ai_timeout",
      "ИИ отвечал слишком долго. Попробуйте ещё раз через минуту или сократите описание.",
      504,
    );
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ListingGenerationError(
      "invalid_api_key",
      setupMessage("Сервер не смог авторизоваться в Anthropic API. Проверьте значение ANTHROPIC_API_KEY и права ключа."),
      503,
      true,
    );
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new ListingGenerationError(
      "model_not_found",
      setupMessage(`Модель «${model}» недоступна. Проверьте значение ANTHROPIC_MODEL.`),
      503,
      true,
    );
  }
  if (error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && error.status === 529)) {
    return new ListingGenerationError(
      "ai_overloaded",
      "Сервис ИИ сейчас перегружен. Подождите минуту и попробуйте снова.",
      503,
      true,
    );
  }
  if (error instanceof Anthropic.InternalServerError) {
    return new ListingGenerationError(
      "ai_overloaded",
      "Сервис ИИ временно недоступен. Подождите минуту и попробуйте снова.",
      503,
    );
  }
  if (error instanceof Anthropic.BadRequestError) {
    const message = error.message.toLowerCase();
    if (message.includes("credit balance")) {
      return new ListingGenerationError(
        "ai_error",
        setupMessage("На аккаунте Anthropic недостаточно средств. Пополните баланс в Anthropic Console."),
        503,
        true,
      );
    }
    if (message.includes("image")) {
      return new ListingGenerationError(
        "image_invalid",
        "Сервис ИИ не смог обработать фото. Попробуйте другое изображение или создайте объявление без фото.",
        400,
        true,
      );
    }
    return new ListingGenerationError(
      "ai_error",
      process.env.NODE_ENV === "production"
        ? "Сервис ИИ отклонил запрос. Попробуйте изменить описание."
        : "Сервис ИИ отклонил запрос. Попробуйте изменить описание. Если ошибка повторяется, проверьте настройки аккаунта Anthropic.",
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
