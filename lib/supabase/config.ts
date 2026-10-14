/**
 * Настройки Supabase Auth. Аккаунты включаются, когда заданы адрес проекта и публикуемый ключ.
 * Публикуемый ключ (sb_publishable_…) не секретный, но в этом приложении он используется только
 * на сервере: регистрация, вход и обновление сессии идут через серверные действия и proxy.ts.
 */

import type { CookieOptions } from "@supabase/ssr";

export type SupabaseConfig = { url: string; publishableKey: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !local) return null;
    return { url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

export function isAuthConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/**
 * Куки сессии недоступны из JavaScript страницы (httpOnly): браузерный клиент Supabase
 * нам не нужен, а так токены не украсть через XSS. SameSite=Lax защищает от CSRF.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
