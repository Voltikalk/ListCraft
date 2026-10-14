import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS, getSupabaseConfig } from "@/lib/supabase/config";

/** Страницы только для вошедших. */
const PROTECTED = ["/account", "/reset-password"];
/** Страницы только для гостей: вошедших отправляем в аккаунт. Сброс пароля доступен всем — например, тем, кто входил через Яндекс ID и хочет задать пароль. */
const GUEST_ONLY = ["/login", "/register"];

function matches(path: string, list: string[]) {
  return list.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Куда отправить гостя с закрытой страницы. */
function guestRedirect(request: NextRequest): URL {
  const path = request.nextUrl.pathname;
  const url = request.nextUrl.clone();
  url.search = "";
  if (matches(path, ["/reset-password"])) {
    url.pathname = "/forgot-password";
    url.searchParams.set("error", "link");
  } else {
    url.pathname = "/login";
    url.searchParams.set("next", path);
  }
  return url;
}

/**
 * Обновляет сессию Supabase (продлевает токен и переписывает куки) и закрывает страницы аккаунта.
 * Это первая линия защиты: страницы и серверные действия всё равно проверяют пользователя сами.
 */
export async function updateSession(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isProtected = matches(path, PROTECTED);
  // Без кук Supabase сессии точно нет — не тратим время на проверку.
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-"));
  if (!hasAuthCookie) {
    return isProtected ? NextResponse.redirect(guestRedirect(request)) : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Ответ с куками сессии нельзя кешировать: иначе CDN может отдать чужую сессию.
        cacheHeaders = headers;
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Между созданием клиента и getClaims() не должно быть другого кода.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  let target: URL | null = null;
  if (!signedIn && isProtected) target = guestRedirect(request);
  if (signedIn && matches(path, GUEST_ONLY)) target = new URL("/account", request.url);
  if (!target) return response;

  // Перенаправление должно унести с собой обновлённые куки и заголовки.
  const redirect = NextResponse.redirect(target);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const [key, value] of Object.entries(cacheHeaders)) redirect.headers.set(key, value);
  return redirect;
}
