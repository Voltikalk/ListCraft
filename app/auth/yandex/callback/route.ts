import { randomBytes } from "node:crypto";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/validation";
import {
  exchangeCode,
  fetchProfile,
  getYandexConfig,
  parseFlow,
  sameState,
  YANDEX_COOKIE,
  YANDEX_COOKIE_PATH,
  YandexError,
} from "@/lib/server/yandex";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Возврат из Яндекс ID. Проверяем state, меняем код на токен, берём основную почту
 * из профиля и входим в аккаунт Supabase с этой почтой (создаём его, если нет).
 */

type Outcome = { ok: true; next: string } | { ok: false; error: string };

export async function GET(request: NextRequest) {
  const outcome = await complete(request);
  // redirect() вызываем вне try/catch: он работает через исключение.
  redirect(outcome.ok ? outcome.next : `/login?error=${outcome.error}`);
}

async function complete(request: NextRequest): Promise<Outcome> {
  const cookieStore = await cookies();
  const flow = parseFlow(cookieStore.get(YANDEX_COOKIE)?.value);
  // Кука одноразовая: удаляем сразу, что бы ни случилось дальше.
  cookieStore.delete({ name: YANDEX_COOKIE, path: YANDEX_COOKIE_PATH });

  const params = request.nextUrl.searchParams;
  if (params.get("error") === "access_denied") return { ok: false, error: "yandex_cancelled" };
  if (!flow || !sameState(flow.state, params.get("state"))) return { ok: false, error: "yandex" };

  const code = params.get("code");
  if (!code || code.length > 256) return { ok: false, error: "yandex" };

  const config = getYandexConfig();
  const admin = createAdminClient();
  const supabase = await createClient();
  if (!config || !admin || !supabase) return { ok: false, error: "yandex_unavailable" };

  let email: string | null;
  try {
    const accessToken = await exchangeCode(config, code, flow.verifier);
    email = (await fetchProfile(accessToken)).email;
  } catch (error) {
    if (error instanceof YandexError) {
      console.error("[auth] yandex request failed", { step: error.step, reason: error.reason });
      return { ok: false, error: error.reason === "unavailable" ? "yandex_unavailable" : "yandex" };
    }
    throw error;
  }
  if (!email) return { ok: false, error: "yandex_email" };

  // Одноразовая ссылка для входа без письма: создаёт пользователя, если его ещё нет.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.user || !link.properties?.hashed_token) {
    logSupabaseError("generate-link", linkError);
    return { ok: false, error: linkError?.code === "user_banned" ? "banned" : "yandex_unavailable" };
  }

  // Кто-то мог заранее зарегистрировать эту почту со своим паролем и не подтвердить её.
  // Почта принадлежит владельцу аккаунта Яндекса, поэтому чужой пароль сбрасываем.
  if (!link.user.email_confirmed_at) {
    const { error } = await admin.auth.admin.updateUserById(link.user.id, { password: randomBytes(48).toString("base64url") });
    if (error) {
      logSupabaseError("reset-unconfirmed-password", error);
      return { ok: false, error: "yandex_unavailable" };
    }
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: link.properties.verification_type as EmailOtpType,
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) {
    logSupabaseError("verify-link", verifyError);
    return { ok: false, error: "yandex_unavailable" };
  }

  return { ok: true, next: safeNext(flow.next) };
}

function logSupabaseError(step: string, error: { name?: string; code?: string; status?: number } | null) {
  console.error("[auth] yandex sign-in failed", { step, type: error?.name, code: error?.code, status: error?.status });
}
