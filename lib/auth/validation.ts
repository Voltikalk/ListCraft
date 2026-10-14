import { z } from "zod";

/**
 * Проверка данных форм входа и регистрации. Выполняется на сервере в каждом действии;
 * атрибуты полей в браузере — только подсказка.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt в Supabase учитывает только первые 72 байта пароля. Кириллица — 2 байта на символ. */
export const PASSWORD_MAX_BYTES = 72;
const EMAIL_MAX_LENGTH = 254;
/** Для входа политику не проверяем (у старых паролей она могла быть другой), только размер. */
const LOGIN_PASSWORD_MAX_LENGTH = 256;

export const PASSWORD_HINT = `Не короче ${PASSWORD_MIN_LENGTH} символов, хотя бы одна буква и одна цифра`;

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

const email = z
  .string({ error: "Укажите почту" })
  .trim()
  .toLowerCase()
  .min(1, "Укажите почту")
  .max(EMAIL_MAX_LENGTH, "Слишком длинный адрес")
  .pipe(z.email("Проверьте адрес почты"));

const newPassword = z
  .string({ error: "Придумайте пароль" })
  .min(PASSWORD_MIN_LENGTH, `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`)
  .refine((value) => byteLength(value) <= PASSWORD_MAX_BYTES, "Слишком длинный пароль: до 72 латинских или 36 русских символов")
  .refine((value) => /\p{L}/u.test(value) && /\p{N}/u.test(value), "Добавьте хотя бы одну букву и одну цифру")
  .refine((value) => value.trim() === value, "Пароль не должен начинаться или заканчиваться пробелом");

const existingPassword = z
  .string({ error: "Введите пароль" })
  .min(1, "Введите пароль")
  .max(LOGIN_PASSWORD_MAX_LENGTH, "Неверная почта или пароль");

export const signInSchema = z.object({ email, password: existingPassword });

export const signUpSchema = z
  .object({ email, password: newPassword, confirmPassword: z.string({ error: "Повторите пароль" }) })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], error: "Пароли не совпадают" })
  .refine((data) => data.password.toLowerCase() !== data.email, { path: ["password"], error: "Пароль не должен совпадать с почтой" });

export const emailSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string({ error: "Повторите пароль" }) })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], error: "Пароли не совпадают" });

export const changePasswordSchema = z
  .object({
    currentPassword: existingPassword,
    password: newPassword,
    confirmPassword: z.string({ error: "Повторите пароль" }),
  })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], error: "Пароли не совпадают" })
  .refine((data) => data.password !== data.currentPassword, { path: ["password"], error: "Новый пароль совпадает с текущим" });

/** Первая ошибка для каждого поля — её и показываем под полем. */
export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

/** Значение поля формы как строка. Файлы и отсутствующие поля превращаются в undefined. */
export function formText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

const NEXT_MAX_LENGTH = 512;

/**
 * Безопасный адрес для перенаправления после входа: только путь на этом же сайте.
 * Защищает от открытого редиректа (`//evil.com`, `/\evil.com`, `https://evil.com`).
 * Абсолютный адрес допускается, только если он совпадает с `siteOrigin`
 * (так Supabase подставляет {{ .RedirectTo }} в письма).
 */
export function safeNext(value: unknown, fallback = "/account", siteOrigin?: string | null): string {
  if (typeof value !== "string" || !value || value.length > NEXT_MAX_LENGTH) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;

  const base = "http://internal.invalid";
  let url: URL;
  try {
    if (value.startsWith("/") && !value.startsWith("//")) {
      url = new URL(value, base);
      if (url.origin !== base) return fallback;
    } else if (siteOrigin) {
      url = new URL(value);
      if (url.origin !== siteOrigin) return fallback;
    } else {
      return fallback;
    }
  } catch {
    return fallback;
  }
  // Ссылки обратно в процесс входа не нужны — это петля.
  if (url.pathname.startsWith("/auth/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
