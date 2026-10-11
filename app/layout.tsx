import type { Metadata, Viewport } from "next";
import { Montserrat, Unbounded } from "next/font/google";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

const body = Montserrat({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
});

/** Широкий жирный шрифт для заголовков — как на референсе «оливковый + кремовый». */
const display = Unbounded({
  variable: "--font-display-face",
  subsets: ["latin", "cyrillic"],
});

const DESCRIPTION =
  "Опишите товар по-русски и получите готовое объявление: на русском для Авито, Ozon и Wildberries или на английском для eBay, Etsy и Amazon. Заголовок, описание, характеристики и ключевые слова.";
const TITLE = `${SITE_NAME} — объявления для маркетплейсов из описания своими словами`;

/** Публичный адрес сайта для ссылок в превью (Open Graph). На Vercel без него Next.js берёт адрес проекта. */
function siteUrl(): URL | undefined {
  try {
    return process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined;
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#fefae0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" data-scroll-behavior="smooth" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
