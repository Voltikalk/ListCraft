import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { CONTACT_EMAIL, mailtoHref, SITE_NAME } from "@/lib/site";

export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100";

export const primaryButton = `inline-flex items-center justify-center gap-2 rounded-full bg-olive-600 px-6 py-3 text-base font-semibold text-cream-100 shadow-glow transition hover:bg-olive-700 active:scale-[0.98] ${focusRing}`;

export const secondaryButton = `inline-flex items-center justify-center gap-2 rounded-full border border-olive-600/40 px-6 py-3 text-base font-semibold text-olive-800 transition hover:border-olive-600 hover:bg-olive-600/10 ${focusRing}`;

/** Кремовая панель — основной блок интерфейса без эффектов. */
export const card = "rounded-3xl border border-olive-900/10 bg-cream-50 shadow-panel";

const CARD_STYLE = {
  "--spotlight-card-surface": "#fffef6",
  "--spotlight-card-border": "rgb(47 53 32 / 0.1)",
  "--spotlight-card-shadow": "0 24px 60px -36px rgb(47 53 32 / 0.45)",
} as CSSProperties;

/** Карточка с подсветкой, которая следует за курсором (React Bits — SpotlightCard). */
export function GlowCard({
  children,
  className = "",
  color = "rgb(96 108 56)",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <SpotlightCard theme="light" spotlightColor={color} intensity={0.14} spotlightSize={320} borderGlow={0.9} className={className} style={CARD_STYLE}>
      {children}
    </SpotlightCard>
  );
}

export function Logo() {
  return (
    <span
      aria-hidden
      className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-olive-600 font-display text-xs font-bold text-cream-100"
    >
      LC
    </span>
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
    <a href={href} className={className ?? "font-medium text-olive-700 underline underline-offset-2 hover:text-olive-900"}>
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-olive-900/15">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 text-sm text-olive-700 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="flex gap-3">
          <Logo />
          <div className="space-y-1">
            <p className="font-medium text-olive-950">{SITE_NAME} — бета-версия</p>
            <p className="text-xs text-olive-600">
              Текст создаётся ИИ и может содержать неточности — проверяйте объявление перед публикацией.{" "}
              <Link href="/#privacy" className="underline underline-offset-2 hover:text-olive-900">
                Как мы обрабатываем данные
              </Link>
            </p>
          </div>
        </div>
        <div className="space-y-1 md:text-right">
          {CONTACT_EMAIL ? (
            <>
              <p className="flex flex-wrap gap-x-4 gap-y-1 md:justify-end">
                <MailLink topic="bug">Сообщить об ошибке</MailLink>
                <MailLink topic="feedback">Оставить отзыв</MailLink>
              </p>
              <p className="text-xs text-olive-600">
                Или напишите на <span className="select-all font-medium text-olive-800">{CONTACT_EMAIL}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-olive-600">Контакт для обратной связи пока не указан.</p>
          )}
        </div>
      </div>
    </footer>
  );
}
