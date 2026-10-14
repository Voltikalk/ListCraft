import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Клиент с секретным ключом — обходит все ограничения доступа. Только для сервера
 * (вход через Яндекс ID). Переменная без NEXT_PUBLIC_, поэтому в браузерный код не попадает.
 * null — секретный ключ не задан.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("admin client is server-only");
  const config = getSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !secretKey) return null;

  return createClient(config.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Отдельный клиент без сохранения сессии — чтобы проверить текущий пароль,
 * не трогая куки пользователя. Созданную при проверке сессию нужно сразу отозвать.
 */
export function createStatelessClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
