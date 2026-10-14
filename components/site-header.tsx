import Link from "next/link";
import { Suspense } from "react";
import { AccountLink, AccountLinkPlaceholder } from "@/components/auth/account-link";
import { focusRing, Logo } from "@/components/site-chrome";
import { SITE_NAME } from "@/lib/site";
import { isAuthConfigured } from "@/lib/supabase/config";

// Шапка читает сессию на сервере, поэтому живёт отдельно от site-chrome:
// стили и MailLink оттуда импортируют и клиентские компоненты.

const NAV = [
  { href: "/#how", label: "Как это работает" },
  { href: "/#example", label: "Пример" },
  { href: "/#pricing", label: "Цены" },
  { href: "/#faq", label: "Вопросы" },
];

export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-olive-900/10 bg-cream-100/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className={`flex items-center gap-2.5 rounded-xl ${focusRing}`}>
          <Logo />
          <span className="text-base font-semibold tracking-tight whitespace-nowrap text-olive-950">{SITE_NAME}</span>
          <span className="hidden rounded-full border border-olive-600/30 bg-olive-600/10 px-2 py-0.5 text-xs font-medium text-olive-700 sm:inline">
            Бета
          </span>
        </Link>
        <nav aria-label="Разделы" className="hidden items-center gap-1 text-sm whitespace-nowrap text-olive-700 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`rounded-full px-3 py-2 transition hover:bg-olive-600/10 hover:text-olive-950 ${focusRing}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isAuthConfigured() && (
            <Suspense fallback={<AccountLinkPlaceholder />}>
              <AccountLink />
            </Suspense>
          )}
          {showCta && (
            <Link
              href="/create"
              className={`shrink-0 rounded-full bg-olive-600 px-4 py-2 text-sm font-semibold text-cream-100 transition hover:bg-olive-700 ${focusRing}`}
            >
              Попробовать
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
