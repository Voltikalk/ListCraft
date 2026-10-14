import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasRecentEmailProof, PASSWORD_RESET_WINDOW_MS } from "@/lib/auth/session";
import { errorMessage } from "@/lib/auth/messages";
import {
  changePasswordSchema,
  emailSchema,
  firstFieldErrors,
  safeNext,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/validation";
import { __resetAuthLimitsForTests, consumeAuthAttempt, tooManyAttemptsMessage } from "@/lib/server/auth-rate-limit";
import {
  buildAuthorizeUrl,
  createPkcePair,
  encodeFlow,
  parseFlow,
  parseYandexProfile,
  sameState,
} from "@/lib/server/yandex";

describe("проверка форм", () => {
  it("нормализует почту и отклоняет неверный адрес", () => {
    const ok = emailSchema.safeParse({ email: "  User@Example.RU " });
    expect(ok.success && ok.data.email).toBe("user@example.ru");
    expect(emailSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(emailSchema.safeParse({ email: `${"a".repeat(250)}@x.ru` }).success).toBe(false);
  });

  it("требует надёжный пароль при регистрации", () => {
    const base = { email: "user@example.ru" };
    const check = (password: string, confirmPassword = password) =>
      signUpSchema.safeParse({ ...base, password, confirmPassword });

    expect(check("abc12345").success).toBe(true);
    expect(check("пароль2024").success).toBe(true);
    expect(check("short1").success).toBe(false);
    expect(check("onlyletters").success).toBe(false);
    expect(check("1234567890").success).toBe(false);
    expect(check(" abc12345").success).toBe(false);
    // 40 кириллических символов — 80 байт, больше лимита bcrypt.
    expect(check(`${"я".repeat(39)}1`).success).toBe(false);

    const mismatch = check("abc12345", "abc12346");
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(firstFieldErrors(mismatch.error)).toHaveProperty("confirmPassword");
  });

  it("не разрешает пароль, совпадающий с почтой", () => {
    const result = signUpSchema.safeParse({ email: "a1@b.ru", password: "A1@b.ru", confirmPassword: "A1@b.ru" });
    expect(result.success).toBe(false);
  });

  it("при входе не проверяет политику старого пароля, но ограничивает размер", () => {
    expect(signInSchema.safeParse({ email: "user@example.ru", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "user@example.ru", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "user@example.ru", password: "x".repeat(257) }).success).toBe(false);
  });

  it("новый пароль должен отличаться от текущего", () => {
    const same = changePasswordSchema.safeParse({ currentPassword: "abc12345", password: "abc12345", confirmPassword: "abc12345" });
    expect(same.success).toBe(false);
  });
});

describe("safeNext — защита от открытого редиректа", () => {
  it("пропускает пути этого сайта", () => {
    expect(safeNext("/create")).toBe("/create");
    expect(safeNext("/account?tab=1#x")).toBe("/account?tab=1#x");
  });

  it("отклоняет чужие адреса и подозрительные строки", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/%0d%0aSet-Cookie:x",
      "/ok\nLocation: https://evil.example",
      "javascript:alert(1)",
      "/auth/confirm",
      "",
      `/${"a".repeat(600)}`,
      42,
      null,
    ]) {
      const result = safeNext(value);
      expect(result.startsWith("/") && !result.startsWith("//"), String(value)).toBe(true);
      expect(result === "/account" || result === "/%0d%0aSet-Cookie:x").toBe(true);
    }
  });

  it("абсолютный адрес — только со своим доменом", () => {
    expect(safeNext("https://listcraft.example/account?x=1", "/", "https://listcraft.example")).toBe("/account?x=1");
    expect(safeNext("https://evil.example/account", "/", "https://listcraft.example")).toBe("/");
  });
});

describe("hasRecentEmailProof", () => {
  const now = 1_800_000_000_000;
  const seconds = (ms: number) => Math.floor(ms / 1000);

  it("принимает недавний вход по ссылке из письма", () => {
    expect(hasRecentEmailProof([{ method: "otp", timestamp: seconds(now - 60_000) }], now)).toBe(true);
    expect(hasRecentEmailProof([{ method: "password", timestamp: seconds(now - 3600_000) }, { method: "recovery", timestamp: seconds(now) }], now)).toBe(true);
  });

  it("отклоняет старую ссылку, вход по паролю и мусор", () => {
    expect(hasRecentEmailProof([{ method: "otp", timestamp: seconds(now - PASSWORD_RESET_WINDOW_MS - 1000) }], now)).toBe(false);
    expect(hasRecentEmailProof([{ method: "password", timestamp: seconds(now) }], now)).toBe(false);
    expect(hasRecentEmailProof([{ method: "otp", timestamp: "now" }], now)).toBe(false);
    expect(hasRecentEmailProof(["otp"], now)).toBe(false);
    expect(hasRecentEmailProof(undefined, now)).toBe(false);
    // Метка из будущего — подделка или сбитые часы.
    expect(hasRecentEmailProof([{ method: "otp", timestamp: seconds(now + 10 * 60_000) }], now)).toBe(false);
  });
});

describe("лимит попыток входа", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    __resetAuthLimitsForTests();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("блокирует перебор с одного адреса и снимает блок после окна", async () => {
    const now = 5_000_000;
    for (let i = 0; i < 10; i++) {
      expect((await consumeAuthAttempt("login", { ip: "1.1.1.1", email: `u${i}@x.ru` }, now)).ok).toBe(true);
    }
    const blocked = await consumeAuthAttempt("login", { ip: "1.1.1.1", email: "other@x.ru" }, now);
    expect(blocked).toEqual({ ok: false, retryAfterSeconds: 15 * 60 });
    expect((await consumeAuthAttempt("login", { ip: "2.2.2.2", email: "other@x.ru" }, now)).ok).toBe(true);
    expect((await consumeAuthAttempt("login", { ip: "1.1.1.1", email: "other@x.ru" }, now + 15 * 60_000)).ok).toBe(true);
  });

  it("ограничивает письма для сброса пароля на один адрес с разных IP", async () => {
    const now = 7_000_000;
    for (let i = 0; i < 3; i++) {
      expect((await consumeAuthAttempt("reset", { ip: `10.0.0.${i}`, email: "victim@x.ru" }, now)).ok).toBe(true);
    }
    expect((await consumeAuthAttempt("reset", { ip: "10.0.0.9", email: "victim@x.ru" }, now)).ok).toBe(false);
  });

  it("сообщение округляет до минут", () => {
    expect(tooManyAttemptsMessage(61)).toBe("Слишком много попыток. Повторите через 2 мин.");
    expect(tooManyAttemptsMessage(1)).toBe("Слишком много попыток. Повторите через 1 мин.");
  });
});

describe("Яндекс ID", () => {
  it("берёт из профиля только id и основную почту", () => {
    expect(parseYandexProfile({ id: "123", login: "user", default_email: "User@Yandex.RU", real_name: "Имя" })).toEqual({
      id: "123",
      email: "user@yandex.ru",
    });
    expect(parseYandexProfile({ id: 123 })).toEqual({ id: "123", email: null });
    expect(parseYandexProfile({ id: "1", default_email: "not-an-email" })).toBeNull();
    expect(parseYandexProfile({ default_email: "a@b.ru" })).toBeNull();
    expect(parseYandexProfile("oops")).toBeNull();
  });

  it("PKCE: challenge — SHA-256 от verifier в base64url", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("кука входа читается обратно, а подделка — нет", () => {
    const flow = { state: "s".repeat(43), verifier: "v".repeat(64), next: "/account" };
    expect(parseFlow(encodeFlow(flow))).toEqual(flow);
    expect(parseFlow("garbage")).toBeNull();
    expect(parseFlow(Buffer.from(JSON.stringify({ ...flow, state: "short" })).toString("base64url"))).toBeNull();
    expect(parseFlow(undefined)).toBeNull();
  });

  it("сравнивает state целиком", () => {
    expect(sameState("abc", "abc")).toBe(true);
    expect(sameState("abc", "abd")).toBe(false);
    expect(sameState("abc", "ab")).toBe(false);
    expect(sameState("abc", null)).toBe(false);
  });

  it("адрес авторизации содержит PKCE и нужные доступы", () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: "client", clientSecret: "secret" }, { redirectUri: "https://site.example/auth/yandex/callback", state: "st", challenge: "ch" }),
    );
    expect(url.origin).toBe("https://oauth.yandex.ru");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("login:email login:info");
    // Секрет приложения никогда не уходит в браузер.
    expect(url.toString()).not.toContain("secret");
  });
});

describe("сообщения об ошибках", () => {
  it("знает только свои коды", () => {
    expect(errorMessage("link")).toMatch(/Ссылка/);
    expect(errorMessage("toString")).toBeNull();
    expect(errorMessage("<script>")).toBeNull();
    expect(errorMessage(undefined)).toBeNull();
  });
});
