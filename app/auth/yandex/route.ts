import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/validation";
import { consumeAuthAttempt } from "@/lib/server/auth-rate-limit";
import { getSiteOrigin } from "@/lib/server/auth-request";
import { getClientKey } from "@/lib/server/rate-limit";
import {
  buildAuthorizeUrl,
  createPkcePair,
  createState,
  encodeFlow,
  getYandexConfig,
  YANDEX_COOKIE,
  YANDEX_COOKIE_MAX_AGE,
  YANDEX_COOKIE_PATH,
} from "@/lib/server/yandex";
import { isAuthConfigured } from "@/lib/supabase/config";

/** Начало входа через Яндекс ID: запоминаем state и PKCE в куке и уходим на oauth.yandex.ru. */
export async function GET(request: NextRequest) {
  // Иначе при сборке без настроек Яндекса ответ (вместе со state и PKCE) застынет как статический.
  await connection();
  const config = getYandexConfig();
  const origin = await getSiteOrigin();
  if (!config || !origin || !isAuthConfigured()) redirect("/login?error=yandex_unavailable");

  const limit = await consumeAuthAttempt("yandex", { ip: getClientKey(await headers()) });
  if (!limit.ok) redirect("/login?error=too_many");

  const state = createState();
  const { verifier, challenge } = createPkcePair();
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  (await cookies()).set(YANDEX_COOKIE, encodeFlow({ state, verifier, next }), {
    path: YANDEX_COOKIE_PATH,
    httpOnly: true,
    // Lax: кука должна прийти при возврате с oauth.yandex.ru (переход по ссылке верхнего уровня).
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YANDEX_COOKIE_MAX_AGE,
  });

  redirect(buildAuthorizeUrl(config, { redirectUri: `${origin}/auth/yandex/callback`, state, challenge }));
}
