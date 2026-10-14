"use server";

/**
 * Серверные действия аккаунта. Каждое действие само проверяет входные данные и пользователя:
 * серверное действие — это POST-запрос, который можно отправить в обход формы и proxy.ts.
 */

import { isAuthApiError, isAuthError, type AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/lib/auth/form-state";
import { hasRecentEmailProof } from "@/lib/auth/session";
import {
  changePasswordSchema,
  emailSchema,
  firstFieldErrors,
  formText,
  resetPasswordSchema,
  safeNext,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/validation";
import { checkHuman, getSiteOrigin } from "@/lib/server/auth-request";
import { consumeAuthAttempt, tooManyAttemptsMessage, type AuthAction } from "@/lib/server/auth-rate-limit";
import { getClientKey } from "@/lib/server/rate-limit";
import { createStatelessClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const NOT_CONFIGURED: AuthFormState = { status: "error", message: "Аккаунты временно недоступны. Попробуйте позже." };
const UNAVAILABLE: AuthFormState = { status: "error", message: "Сервис аккаунтов не ответил. Попробуйте через минуту." };

/** В журнал — только код и статус ошибки: без почты, паролей и токенов. */
function logAuthError(step: string, error: unknown) {
  console.error("[auth] request failed", {
    step,
    type: error instanceof Error ? error.name : typeof error,
    code: isAuthError(error) ? error.code : undefined,
    status: isAuthError(error) ? error.status : undefined,
  });
}

/** Ответы Supabase, которые стоит объяснить пользователю. Остальное — общая ошибка. */
function describeSupabaseError(error: AuthError): string | null {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "Сейчас не получается отправить письмо — превышен лимит. Попробуйте позже.";
    case "over_request_rate_limit":
      return "Слишком много запросов. Попробуйте через несколько минут.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Регистрация по почте сейчас выключена.";
    case "user_banned":
      return "Вход в этот аккаунт заблокирован.";
  }
  return error.status === 429 ? "Слишком много запросов. Попробуйте через несколько минут." : null;
}

function weakPasswordMessage(error: AuthError): string | null {
  if (error.code !== "weak_password") return null;
  const reasons = "reasons" in error && Array.isArray(error.reasons) ? error.reasons.map(String) : [];
  return reasons.includes("pwned")
    ? "Этот пароль встречался в утечках данных. Придумайте другой."
    : "Пароль слишком простой. Сделайте его длиннее или добавьте другие символы.";
}

/**
 * Проверка «Я не робот» и лимит попыток. Для действий вошедшего пользователя (смена пароля)
 * капча не нужна: их ограничивает лимит по аккаунту.
 */
async function requestContext(formData: FormData, action: AuthAction, subjects: { email?: string; user?: string } = {}) {
  const clientKey = getClientKey(await headers());
  if (!subjects.user) {
    const humanError = await checkHuman(formData, clientKey);
    if (humanError) return { error: humanError } as const;
  }
  const limit = await consumeAuthAttempt(action, { ip: clientKey, ...subjects });
  if (!limit.ok) return { error: tooManyAttemptsMessage(limit.retryAfterSeconds) } as const;
  return { error: null } as const;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = formText(formData, "email")?.slice(0, 254);
  const parsed = signInSchema.safeParse({ email: formText(formData, "email"), password: formText(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error), email: rawEmail };
  const { email, password } = parsed.data;

  const context = await requestContext(formData, "login", { email });
  if (context.error) return { status: "error", message: context.error, email };

  const supabase = await createClient();
  if (!supabase) return { ...NOT_CONFIGURED, email };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        email,
        message: "Почта ещё не подтверждена. Откройте ссылку из письма. Если письма нет — зарегистрируйтесь ещё раз с этим адресом, мы пришлём новое.",
      };
    }
    // Одинаковый ответ для «нет такого аккаунта» и «неверный пароль» — не раскрываем, кто зарегистрирован.
    if (error.code === "invalid_credentials" || (isAuthApiError(error) && error.status === 400)) {
      return { status: "error", email, message: "Неверная почта или пароль." };
    }
    logAuthError("sign-in", error);
    return { status: "error", email, message: describeSupabaseError(error) ?? UNAVAILABLE.message };
  }

  redirect(safeNext(formText(formData, "next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = formText(formData, "email")?.slice(0, 254);
  const parsed = signUpSchema.safeParse({
    email: formText(formData, "email"),
    password: formText(formData, "password"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error), email: rawEmail };
  const { email, password } = parsed.data;

  const context = await requestContext(formData, "signup");
  if (context.error) return { status: "error", message: context.error, email };

  const [supabase, origin] = await Promise.all([createClient(), getSiteOrigin()]);
  if (!supabase || !origin) return { ...NOT_CONFIGURED, email };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/account` },
  });
  if (error) {
    const weak = weakPasswordMessage(error);
    if (weak) return { status: "error", email, fieldErrors: { password: weak } };
    // Не сообщаем, что адрес уже занят: это раскрыло бы, кто зарегистрирован.
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      logAuthError("sign-up", error);
      return { status: "error", email, message: describeSupabaseError(error) ?? UNAVAILABLE.message };
    }
  }
  // Подтверждение почты выключено в Supabase — пользователь уже вошёл.
  if (data?.session) redirect("/account");

  return {
    status: "success",
    email,
    message: "Если адрес ещё не зарегистрирован, мы отправили на него письмо со ссылкой для подтверждения. Ссылка действует ограниченное время.",
  };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = formText(formData, "email")?.slice(0, 254);
  const parsed = emailSchema.safeParse({ email: formText(formData, "email") });
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error), email: rawEmail };
  const { email } = parsed.data;

  const context = await requestContext(formData, "reset", { email });
  if (context.error) return { status: "error", message: context.error, email };

  const [supabase, origin] = await Promise.all([createClient(), getSiteOrigin()]);
  if (!supabase || !origin) return { ...NOT_CONFIGURED, email };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    const known = describeSupabaseError(error);
    logAuthError("reset-request", error);
    if (known) return { status: "error", email, message: known };
    // Для остальных ошибок ответ такой же, как при успехе, — не раскрываем, есть ли аккаунт.
  }

  return {
    status: "success",
    email,
    message: "Если аккаунт с этой почтой существует, мы отправили письмо со ссылкой для сброса пароля.",
  };
}

/** Новый пароль по ссылке из письма. Без старого пароля — только сразу после перехода по ссылке. */
export async function setNewPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formText(formData, "password"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub || !hasRecentEmailProof(claims.amr)) {
    return { status: "error", message: "Ссылка для сброса пароля устарела. Запросите новую." };
  }

  const context = await requestContext(formData, "password", { user: claims.sub });
  if (context.error) return { status: "error", message: context.error };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return passwordUpdateError(error);

  // Остальные устройства выходят: если пароль сбрасывали из-за взлома, чужие сессии закрываются.
  await revokeOtherSessions(supabase);
  redirect("/account?password=updated");
}

/** Смена пароля в аккаунте — нужен текущий пароль. */
export async function changePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formText(formData, "currentPassword"),
    password: formText(formData, "password"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) redirect("/login?next=/account");

  const context = await requestContext(formData, "password", { user: user.id });
  if (context.error) return { status: "error", message: context.error };

  // Проверяем текущий пароль отдельным клиентом, чтобы не трогать куки текущей сессии.
  const checker = createStatelessClient();
  if (!checker) return NOT_CONFIGURED;
  const { error: checkError } = await checker.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (checkError) {
    if (checkError.code === "invalid_credentials" || (isAuthApiError(checkError) && checkError.status === 400)) {
      return { status: "error", fieldErrors: { currentPassword: "Неверный текущий пароль" } };
    }
    logAuthError("password-check", checkError);
    return { status: "error", message: describeSupabaseError(checkError) ?? UNAVAILABLE.message };
  }
  // Сессия, созданная для проверки, больше не нужна.
  await checker.auth.signOut({ scope: "local" }).catch((error) => logAuthError("password-check-signout", error));

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return passwordUpdateError(error);

  await revokeOtherSessions(supabase);
  return { status: "success", message: "Пароль изменён. На других устройствах нужно будет войти заново." };
}

function passwordUpdateError(error: AuthError): AuthFormState {
  if (error.code === "same_password") return { status: "error", fieldErrors: { password: "Новый пароль совпадает с текущим" } };
  const weak = weakPasswordMessage(error);
  if (weak) return { status: "error", fieldErrors: { password: weak } };
  if (error.code === "reauthentication_needed") {
    return { status: "error", message: "Для смены пароля войдите в аккаунт заново." };
  }
  logAuthError("password-update", error);
  return { status: "error", message: describeSupabaseError(error) ?? UNAVAILABLE.message };
}

async function revokeOtherSessions(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>) {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) logAuthError("sign-out-others", error);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) logAuthError("sign-out", error);
  }
  redirect("/");
}

export async function signOutEverywhere(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) logAuthError("sign-out-global", error);
  }
  redirect("/login?signed_out=all");
}
