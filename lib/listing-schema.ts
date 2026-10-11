import { z } from "zod";

/**
 * Общие схемы и ограничения. Используются и в браузере (быстрая проверка формы),
 * и на сервере (обязательная проверка перед обращением к ИИ).
 */

export const FIELD_LIMITS = {
  productName: 120,
  brand: 80,
  dimensions: 200,
  color: 80,
  material: 120,
  details: 2000,
} as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 МБ — лимит на выбираемый пользователем файл
/**
 * Лимит Anthropic API (5 МБ) действует на изображение в base64, т.е. на ~4/3 исходного размера.
 * Поэтому на сервер (и в API) можно отправить не больше ~3,75 МБ «сырых» байт.
 * Обычно браузер уменьшает фото до ~0,2–0,5 МБ, так что лимит важен только как страховка.
 */
export const MAX_API_IMAGE_BYTES = Math.floor((MAX_IMAGE_BYTES * 3) / 4);
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const TITLE_MAX_LENGTH = 80;

export const CONDITION_OPTIONS = [
  { value: "", label: "Не указано", en: "" },
  { value: "new_with_tags", label: "Новый, с бирками / в упаковке", en: "New with tags / in original packaging" },
  { value: "new_without_tags", label: "Новый, без бирок / без упаковки", en: "New without tags / without original packaging" },
  { value: "used_like_new", label: "Б/у, как новый", en: "Used, like new" },
  { value: "used_good", label: "Б/у, хорошее состояние", en: "Used, good condition" },
  { value: "used_fair", label: "Б/у, заметные следы использования", en: "Used, fair condition with visible signs of wear" },
  { value: "for_parts", label: "Неисправен / на запчасти", en: "For parts or not working" },
] as const;

export type ConditionValue = (typeof CONDITION_OPTIONS)[number]["value"];
const CONDITION_VALUES = CONDITION_OPTIONS.map((o) => o.value) as [ConditionValue, ...ConditionValue[]];

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Поле «${label}» должно быть не длиннее ${max} символов`)
    .default("");

export const listingInputSchema = z.object({
  productName: z
    .string()
    .trim()
    .min(2, "Укажите название или тип товара (минимум 2 символа)")
    .max(FIELD_LIMITS.productName, `Название должно быть не длиннее ${FIELD_LIMITS.productName} символов`),
  brand: optionalText(FIELD_LIMITS.brand, "Бренд"),
  condition: z.enum(CONDITION_VALUES, { error: "Выберите состояние из списка" }).default(""),
  dimensions: optionalText(FIELD_LIMITS.dimensions, "Размеры или параметры"),
  color: optionalText(FIELD_LIMITS.color, "Цвет"),
  material: optionalText(FIELD_LIMITS.material, "Материал"),
  details: optionalText(FIELD_LIMITS.details, "Дополнительное описание"),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

/**
 * Схема структурированного ответа модели. Намеренно простая (только строки,
 * массивы и enum), чтобы соответствовать возможностям structured outputs.
 */
export const listingOutputSchema = z.object({
  title: z.string().describe("Marketplace listing title in English, at most 80 characters"),
  description: z.string().describe("Listing description in English, plain text, short paragraphs"),
  confirmed_specs: z
    .array(
      z.object({
        name: z.string().describe("Specification name in English, e.g. 'Brand', 'Color'"),
        value: z.string().describe("Specification value in English"),
        source: z
          .enum(["seller", "photo"])
          .describe("'seller' if stated by the seller, 'photo' if only visible in the photo"),
      }),
    )
    .describe("Only facts stated by the seller or clearly visible in the photo"),
  keywords: z.array(z.string()).describe("Search keywords / tags in English"),
  missing_details: z
    .array(z.string())
    .describe("In Russian: details the seller should clarify to improve the listing"),
});

export type ListingOutput = z.infer<typeof listingOutputSchema>;

/** Ответ API при успехе. */
export type GenerateSuccess = {
  ok: true;
  listing: ListingOutput;
  /** Сколько бесплатных генераций осталось клиенту на сутки (по счётчику этого сервера). */
  remainingToday?: number;
};

export type GenerateErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "model_not_found"
  | "validation_error"
  | "image_invalid"
  | "payload_too_large"
  | "rate_limited"
  | "busy"
  | "ai_overloaded"
  | "ai_timeout"
  | "ai_refused"
  | "ai_invalid_output"
  | "ai_error"
  | "internal_error";

/** Ответ API при ошибке. message всегда на русском и пригоден для показа пользователю. */
export type GenerateFailure = {
  ok: false;
  error: { code: GenerateErrorCode; message: string; fields?: Record<string, string> };
  /** Остаток бесплатной квоты, если сервер его знает (например, после неудачной попытки). */
  remainingToday?: number;
};

export type GenerateResponse = GenerateSuccess | GenerateFailure;
