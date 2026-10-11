import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton, SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold text-indigo-700">Ошибка 404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Страница не найдена</h1>
        <p className="mt-2 text-slate-600">Возможно, ссылка устарела или в адресе опечатка.</p>
        <Link href="/" className={`${primaryButton} mt-6`}>
          На главную
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
