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
        <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mb-8 max-w-2xl">
            <p className="border-t border-olive-900/20 pt-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-olive-600">Генератор</p>
            <h1 className="font-display mt-6 text-3xl leading-[1.05] font-bold tracking-[-0.03em] text-olive-700 lowercase sm:text-5xl">
              Создать объявление
            </h1>
            <p className="mt-3 leading-relaxed text-olive-700">
              Выберите площадки, опишите товар по-русски и нажмите «Создать объявление». Бесплатно —{" "}
              {listingsCount(freePerDay)} за 24 часа.
            </p>
          </div>
          <ListingGenerator />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
