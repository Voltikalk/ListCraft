import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/validation";
import { getSiteOrigin } from "@/lib/server/auth-request";
import { createClient } from "@/lib/supabase/server";

/**
 * Ссылки из писем: подтверждение почты и сброс пароля.
 * Поддерживает оба формата Supabase: `token_hash` + `type` (рекомендуемый шаблон письма,
 * работает на любом устройстве) и `code` (PKCE — только в том же браузере, где начинали).
 */

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
const MAX_PARAM_LENGTH = 512;

function param(request: NextRequest, name: string): string | null {
  const value = request.nextUrl.searchParams.get(name);
  return value && value.length <= MAX_PARAM_LENGTH ? value : null;
}

export async function GET(request: NextRequest) {
  const tokenHash = param(request, "token_hash");
  const rawType = param(request, "type");
  const code = param(request, "code");
  const type = rawType && OTP_TYPES.has(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;

  const origin = await getSiteOrigin();
  const fallback = type === "recovery" ? "/reset-password" : "/account";
  const next = safeNext(request.nextUrl.searchParams.get("next"), fallback, origin);
  const failure = next.startsWith("/reset-password") ? "/forgot-password?error=link" : "/login?error=link";

  // Supabase сам передаёт ошибку в адресе, если ссылка устарела или уже использована.
  if (request.nextUrl.searchParams.has("error") || request.nextUrl.searchParams.has("error_code")) redirect(failure);

  const supabase = await createClient();
  if (!supabase) redirect("/login?error=config");

  let failed = true;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
    if (error) logConfirmError("verify-otp", error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
    if (error) logConfirmError("exchange-code", error);
  }

  redirect(failed ? failure : next);
}

function logConfirmError(step: string, error: { name?: string; code?: string; status?: number }) {
  // Ссылка устарела или уже использована — обычная ситуация, без подробностей и токенов.
  console.warn("[auth] email link rejected", { step, type: error.name, code: error.code, status: error.status });
}
