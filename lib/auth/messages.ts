/** Сообщения для параметра ?error= после перенаправлений (ссылки из писем, Яндекс ID). */
const ERROR_MESSAGES: Record<string, string> = {
  link: "Ссылка недействительна или устарела. Ссылки из писем одноразовые и действуют ограниченное время.",
  config: "Вход временно недоступен. Попробуйте позже.",
  yandex: "Не удалось войти через Яндекс ID. Попробуйте ещё раз.",
  yandex_email: "В аккаунте Яндекса не указана основная почта. Добавьте её в Яндекс ID или зарегистрируйтесь по почте.",
  yandex_cancelled: "Вход через Яндекс ID отменён.",
  yandex_unavailable: "Вход через Яндекс ID сейчас недоступен. Попробуйте позже или войдите по почте.",
  too_many: "Слишком много попыток. Повторите через несколько минут.",
  banned: "Вход в этот аккаунт заблокирован.",
};

export function errorMessage(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(ERROR_MESSAGES, code) ? ERROR_MESSAGES[code] : null;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Первое значение параметра адреса. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
