import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL, mailtoHref, SITE_NAME } from "@/lib/site";

export const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

const NAV = [
  { href: "/#how", label: "Как это работает" },
  { href: "/#example", label: "Пример" },
  { href: "/#pricing", label: "Цены" },
  { href: "/#faq", label: "Вопросы" },
];

export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            LC
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">{SITE_NAME}</span>
          <span className="hidden rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 sm:inline">Бета</span>
        </Link>
        <nav aria-label="Разделы" className="hidden items-center gap-5 text-sm text-slate-600 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
        {showCta && (
          <Link
            href="/create"
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Попробовать
          </Link>
        )}
      </div>
    </header>
  );
}

/** Ссылка на письмо с готовой темой. Если адрес не настроен — ничего не рисует. */
export function MailLink({
  topic,
  children,
  className,
}: {
  topic: Parameters<typeof mailtoHref>[0];
  children: ReactNode;
  className?: string;
}) {
  const href = mailtoHref(topic);
  if (!href) return null;
  return (
    <a href={href} className={className ?? "font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-600"}>
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm text-slate-600 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{SITE_NAME} — бета-версия</p>
          <p className="text-xs text-slate-500">
            Текст создаётся ИИ и может содержать неточности — проверяйте объявление перед публикацией.{" "}
            <Link href="/#privacy" className="underline underline-offset-2 hover:text-slate-700">
              Как мы обрабатываем данные
            </Link>
          </p>
        </div>
        <div className="space-y-1 md:text-right">
          {CONTACT_EMAIL ? (
            <>
              <p className="flex flex-wrap gap-x-4 gap-y-1 md:justify-end">
                <MailLink topic="bug">Сообщить об ошибке</MailLink>
                <MailLink topic="feedback">Оставить отзыв</MailLink>
              </p>
              <p className="text-xs text-slate-500">
                Или напишите на <span className="select-all font-medium text-slate-700">{CONTACT_EMAIL}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">Контакт для обратной связи пока не указан.</p>
          )}
        </div>
      </div>
    </footer>
  );
}
