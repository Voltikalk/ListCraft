import type { Metadata } from "next";
import { ListingGenerator } from "@/components/listing-generator";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getLimits } from "@/lib/server/rate-limit";
import { listingsCount } from "@/lib/site";

export const metadata: Metadata = {
  title: "Создать объявление",
  description:
    "Опишите товар по-русски — ИИ составит объявление на русском для Авито, Ozon и Wildberries или на английском для eBay, Etsy и Amazon.",
};

export default function CreatePage() {
  const freePerDay = getLimits().perDay;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader showCta={false} />

      <main className="bg-glow relative flex-1">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-80" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-olive-900/10 pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-olive-600">Генератор</p>
              <h1 className="font-display mt-2 text-3xl leading-[1.05] font-bold tracking-[-0.03em] text-olive-700 sm:text-4xl">
                Создать объявление
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-olive-700">
                Товар → настройки → готовое объявление. Пишите по-русски.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-olive-600/30 bg-olive-600/10 px-3 py-1.5 text-xs font-medium text-olive-700">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-olive-600" />
              Бесплатно — {listingsCount(freePerDay)} за 24 часа
            </span>
          </div>
          <ListingGenerator />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
