import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_OPTIONS, getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Клиент Supabase для серверных компонентов, серверных действий и обработчиков маршрутов.
 * Создавайте новый клиент на каждый запрос. null — аккаунты не настроены.
 *
 * На сервере не доверяйте getSession(): проверяйте пользователя через getClaims() или getUser().
 */
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Серверный компонент не может менять куки. Сессию обновляет proxy.ts.
        }
      },
    },
  });
}
