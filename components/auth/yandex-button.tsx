import { focusRing } from "@/components/site-chrome";

/**
 * Вход через Яндекс ID. Обычная ссылка, не <Link>: переход уходит на сервер и дальше на oauth.yandex.ru,
 * предзагружать его нельзя.
 */
export function YandexButton({ next }: { next?: string }) {
  const href = next && next !== "/account" ? `/auth/yandex?next=${encodeURIComponent(next)}` : "/auth/yandex";
  return (
    <a
      href={href}
      className={`inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-olive-900/15 bg-cream-50 px-6 py-3 text-base font-semibold text-olive-950 transition hover:border-olive-900/30 hover:bg-white ${focusRing}`}
    >
      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fc3f1d] text-sm font-bold text-white">
        Я
      </span>
      Войти с Яндекс ID
    </a>
  );
}

/** Разделитель «или» между Яндекс ID и формой. */
export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-olive-600">
      <span aria-hidden className="h-px flex-1 bg-olive-900/15" />
      или
      <span aria-hidden className="h-px flex-1 bg-olive-900/15" />
    </div>
  );
}
