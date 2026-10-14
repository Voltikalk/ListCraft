import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton, SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="bg-glow relative flex flex-1">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-80" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start justify-center px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive-600">Ошибка 404</p>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.03em] text-olive-700 sm:text-5xl">Страница не найдена</h1>
          <p className="mt-3 text-olive-700">Возможно, ссылка устарела или в адресе опечатка.</p>
          <Link href="/" className={`${primaryButton} mt-6`}>
            На главную
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
