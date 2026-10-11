import type { Metadata } from "next";
import { ListingGenerator } from "@/components/listing-generator";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getLimits } from "@/lib/server/rate-limit";
import { listingsCount } from "@/lib/site";

export const metadata: Metadata = {
  title: "Создать объявление",
  description: "Опишите товар по-русски — ИИ составит объявление на английском для eBay, Etsy и Amazon.",
};

export default function CreatePage() {
  const freePerDay = getLimits().perDay;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader showCta={false} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Создать объявление</h1>
          <p className="mt-2 text-slate-600">
            Заполните форму по-русски и нажмите «Создать объявление». Бесплатно — {listingsCount(freePerDay)} за 24 часа.
          </p>
        </div>
        <ListingGenerator />
      </main>

      <SiteFooter />
    </div>
  );
}
