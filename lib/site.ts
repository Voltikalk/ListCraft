/**
 * Настройки сайта, общие для лендинга и приложения.
 * NEXT_PUBLIC_* подставляются в код при `next build` — после изменения нужна пересборка.
 */

export const SITE_NAME = "ListCraft Global";

/** Экспериментальная цена для проверки готовности платить. Оплата НЕ подключена. */
export const PAID_PACK = { price: "$4.99", generations: 25 } as const;

const PLURAL_RULES = new Intl.PluralRules("ru");

/** «1 объявление», «3 объявления», «5 объявлений». */
export function listingsCount(n: number): string {
  const form = PLURAL_RULES.select(n);
  return `${n} ${form === "one" ? "объявление" : form === "few" ? "объявления" : "объявлений"}`;
}

// Без символов, которые изменили бы ссылку mailto: (?, &, # и т.п.).
const EMAIL_RE = /^[^\s@<>"?&#,;:/\\]+@[^\s@<>"?&#,;:/\\]+\.[^\s@<>"?&#,;:/\\]+$/;

/** Адрес для обратной связи и заявок. null — не настроен (тогда ссылки не показываются). */
export const CONTACT_EMAIL: string | null = (() => {
  const value = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "";
  return EMAIL_RE.test(value) ? value : null;
})();

/** Публичный ключ Cloudflare Turnstile. null — проверка «Я не робот» выключена. */
export const TURNSTILE_SITE_KEY: string | null = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

export type MailTopic = "bug" | "feedback" | "paid";

const MAIL_TEMPLATES: Record<MailTopic, { subject: string; body: string }> = {
  bug: {
    subject: "ListCraft: ошибка",
    body: "Что вы делали:\n\nЧто произошло:\n\nЧто ожидали:\n\nУстройство и браузер:\n",
  },
  feedback: {
    subject: "ListCraft: отзыв",
    body: "Где вы продаёте (eBay, Etsy, Amazon…):\n\nЧто понравилось или мешает:\n",
  },
  paid: {
    subject: `ListCraft: хочу пакет ${PAID_PACK.generations} объявлений за ${PAID_PACK.price}`,
    body:
      `Здравствуйте! Мне интересен пакет ${PAID_PACK.generations} объявлений за ${PAID_PACK.price}.\n` +
      "Напишите, когда оплата будет доступна.\n\n" +
      "Где я продаю (необязательно):\n" +
      "Сколько объявлений в месяц мне нужно (необязательно):\n",
  },
};

/** Ссылка mailto: с готовой темой. Данные формы и объявления в письмо не подставляются. */
export function mailtoHref(topic: MailTopic): string | null {
  if (!CONTACT_EMAIL) return null;
  const { subject, body } = MAIL_TEMPLATES[topic];
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
