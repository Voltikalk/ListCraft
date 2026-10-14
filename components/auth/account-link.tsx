import Link from "next/link";
import { focusRing } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";

/** Ссылка в шапке: «Войти» для гостя, «Аккаунт» для вошедшего. На узком экране — только значок. */
export async function AccountLink() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const label = signedIn ? "Аккаунт" : "Войти";

  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      aria-label={label}
      className={`flex shrink-0 items-center gap-1.5 rounded-full p-2 text-sm font-medium text-olive-800 transition hover:bg-olive-600/10 hover:text-olive-950 sm:px-3 ${focusRing}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/** Место под ссылку, пока она загружается. */
export function AccountLinkPlaceholder() {
  return <span aria-hidden className="block h-9 w-9 shrink-0 sm:w-24" />;
}
