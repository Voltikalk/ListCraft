import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Вход через Яндекс ID (OAuth 2.0 с PKCE). Supabase не умеет работать с Яндексом напрямую,
 * поэтому код обмениваем сами, на сервере, а сессию Supabase создаём по подтверждённой почте.
 * Документация: https://yandex.ru/dev/id/doc/ru/codes/code-url и https://yandex.ru/dev/id/doc/ru/user-information
 */

const AUTHORIZE_URL = "https://oauth.yandex.ru/authorize";
const TOKEN_URL = "https://oauth.yandex.ru/token";
const PROFILE_URL = "https://login.yandex.ru/info?format=json";
const TIMEOUT_MS = 5_000;

export const YANDEX_COOKIE = "lc_yandex_oauth";
export const YANDEX_COOKIE_PATH = "/auth/yandex";
export const YANDEX_COOKIE_MAX_AGE = 10 * 60;

export type YandexConfig = { clientId: string; clientSecret: string };

/** Ключи приложения Яндекс ID. Секрет — только на сервере, без NEXT_PUBLIC_. */
export function getYandexConfig(): YandexConfig | null {
  const clientId = process.env.YANDEX_CLIENT_ID?.trim();
  const clientSecret = process.env.YANDEX_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function isYandexConfigured(): boolean {
  return getYandexConfig() !== null;
}

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Пара PKCE: verifier храним в куке, challenge отправляем в Яндекс. */
export function createPkcePair() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createState(): string {
  return randomToken(32);
}

export function buildAuthorizeUrl(config: YandexConfig, params: { redirectUri: string; state: string; challenge: string }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", "login:email login:info");
  return url.toString();
}

/** Содержимое куки на время входа: state против CSRF, verifier для PKCE и адрес возврата. */
const flowSchema = z.object({
  state: z.string().min(20).max(128),
  verifier: z.string().min(43).max(128),
  next: z.string().max(512),
});
export type YandexFlow = z.infer<typeof flowSchema>;

export function encodeFlow(flow: YandexFlow): string {
  return Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
}

export function parseFlow(value: string | undefined): YandexFlow | null {
  if (!value || value.length > 2048) return null;
  try {
    const parsed = flowSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Сравнение state без утечки времени выполнения. */
export function sameState(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class YandexError extends Error {
  constructor(
    readonly step: "token" | "profile",
    readonly reason: "unavailable" | "rejected" | "invalid",
  ) {
    super(`yandex ${step} ${reason}`);
    this.name = "YandexError";
  }
}

const tokenSchema = z.object({ access_token: z.string().min(1).max(4096) });

export async function exchangeCode(config: YandexConfig, code: string, verifier: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: verifier,
  });
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new YandexError("token", "unavailable");
  }
  if (response.status >= 500) throw new YandexError("token", "unavailable");
  if (!response.ok) throw new YandexError("token", "rejected");
  const parsed = tokenSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new YandexError("token", "invalid");
  return parsed.data.access_token;
}

/** Нужны только идентификатор и основная почта. Имя, телефон и прочее не запрашиваем. */
const profileSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(64)),
  default_email: z.string().trim().toLowerCase().max(254).pipe(z.email()).optional().nullable(),
});

export type YandexProfile = { id: string; email: string | null };

export function parseYandexProfile(data: unknown): YandexProfile | null {
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) return null;
  return { id: parsed.data.id, email: parsed.data.default_email ?? null };
}

export async function fetchProfile(accessToken: string): Promise<YandexProfile> {
  let response: Response;
  try {
    response = await fetch(PROFILE_URL, {
      headers: { Authorization: `OAuth ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new YandexError("profile", "unavailable");
  }
  if (response.status >= 500) throw new YandexError("profile", "unavailable");
  if (!response.ok) throw new YandexError("profile", "rejected");
  const profile = parseYandexProfile(await response.json().catch(() => null));
  if (!profile) throw new YandexError("profile", "invalid");
  return profile;
}
