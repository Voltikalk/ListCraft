import type { ReactNode } from "react";
import { card, SiteFooter } from "@/components/site-chrome";
import { SiteHeader } from "@/components/site-header";
import { isAuthConfigured } from "@/lib/supabase/config";

/** Общий макет страниц входа, регистрации и аккаунта — в стиле остального сайта. */
export function AuthShell({
  eyebrow = "Аккаунт",
  title,
  description,
  wide = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Широкая колонка — для страницы аккаунта. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="bg-glow relative flex-1">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-80" />
        <div className={`relative mx-auto w-full px-4 py-10 sm:px-6 sm:py-14 ${wide ? "max-w-3xl" : "max-w-md"}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-olive-600">{eyebrow}</p>
          <h1 className="font-display mt-2 text-3xl leading-[1.05] font-bold tracking-[-0.03em] text-olive-700 sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 text-sm leading-relaxed text-olive-700">{description}</p>}
          <div className="mt-6">{isAuthConfigured() ? children : <AuthSetupNotice />}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Панель для форм. */
export function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${card} p-5 sm:p-7 ${className}`}>{children}</div>;
}

const code = "rounded bg-olive-600/10 px-1 py-0.5 text-xs text-olive-900";

/** Аккаунты не настроены. Инструкции видит только разработчик. */
function AuthSetupNotice() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div role="status" className="rounded-2xl border border-olive-600/25 bg-olive-600/[0.07] p-5 text-sm text-olive-800">
        <p className="text-base font-semibold text-olive-950">Вход и регистрация временно недоступны</p>
        <p className="mt-1 text-olive-700">Генератором можно пользоваться и без аккаунта.</p>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-2xl border border-olive-600/25 bg-olive-600/[0.07] p-5 text-sm text-olive-800">
      <p className="text-base font-semibold text-olive-950">Аккаунты ещё не настроены</p>
      <p className="mt-1 text-olive-700">Чтобы включить вход и регистрацию:</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5">
        <li>Создайте проект в Supabase и включите вход по почте с подтверждением адреса.</li>
        <li>
          В <code className={code}>.env.local</code> укажите <code className={code}>NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
          <code className={code}>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>. Для входа через Яндекс ID ещё нужны{" "}
          <code className={code}>SUPABASE_SECRET_KEY</code>, <code className={code}>YANDEX_CLIENT_ID</code> и{" "}
          <code className={code}>YANDEX_CLIENT_SECRET</code>.
        </li>
        <li>
          Перезапустите сервер: <code className={code}>npm run dev</code>.
        </li>
      </ol>
      <p className="mt-3 text-xs text-olive-600">Подробности — в комментариях файла .env.example.</p>
    </div>
  );
}
