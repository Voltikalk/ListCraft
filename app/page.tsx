import Link from "next/link";
import { MailLink, primaryButton, secondaryButton, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { DEMO_LISTING, EXAMPLE_INPUT } from "@/lib/demo-listing";
import { CONDITION_OPTIONS } from "@/lib/listing-schema";
import { getLimits } from "@/lib/server/rate-limit";
import { CONTACT_EMAIL, listingsCount, PAID_PACK } from "@/lib/site";

const FEATURES = [
  { title: "Заголовок", text: "ИИ старается уложиться в 80 символов — столько допускает eBay. Рядом с полем есть счётчик." },
  { title: "Описание", text: "Короткие абзацы на понятном английском, без рекламных преувеличений." },
  { title: "Характеристики", text: "Факты из вашего текста или с фото. Всё, что взято с фото, помечено отдельно." },
  { title: "Ключевые слова", text: "Поисковые фразы на английском — для тегов и поиска на площадке." },
  { title: "Что уточнить", text: "Список на русском: каких данных не хватает, чтобы объявление было полнее." },
];

const STEPS = [
  {
    title: "Опишите товар по-русски",
    text: "Обязательно только название. Бренд, состояние, размеры и детали — если знаете. Фото — по желанию.",
  },
  {
    title: "ИИ составит объявление",
    text: "Заголовок, описание, характеристики и ключевые слова на английском. ИИ получает инструкцию не додумывать недостающее, а перечислить его отдельно.",
  },
  {
    title: "Проверьте и скопируйте",
    text: "Каждое поле можно отредактировать и скопировать — по отдельности или всё сразу — и вставить на площадку.",
  },
];

function exampleInputRows() {
  const condition = CONDITION_OPTIONS.find((o) => o.value === EXAMPLE_INPUT.condition)?.label ?? "";
  return [
    { label: "Название или тип товара", value: EXAMPLE_INPUT.productName },
    { label: "Бренд", value: EXAMPLE_INPUT.brand },
    { label: "Состояние", value: condition },
    { label: "Цвет", value: EXAMPLE_INPUT.color },
    { label: "Размеры или параметры", value: EXAMPLE_INPUT.dimensions },
    { label: "Дополнительное описание", value: EXAMPLE_INPUT.details },
  ].filter((row) => row.value);
}

function SectionTitle({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="scroll-mt-20 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      {lead && <p className="mt-2 text-base text-slate-600">{lead}</p>}
    </div>
  );
}

export default function Home() {
  const freeQuota = `${listingsCount(getLimits().perDay)} за 24 часа`;
  const listing = DEMO_LISTING;
  const inputRows = exampleInputRows();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Первый экран */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Объявление на английском для eBay, Etsy и Amazon — из описания на русском
              </h1>
              <p className="mt-4 text-lg text-slate-600">
                Опишите товар своими словами и, если хотите, добавьте фото. ListCraft Global составит заголовок,
                описание, характеристики и ключевые слова на английском. ИИ получает инструкцию брать факты только из
                ваших данных и не додумывать остальное.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/create" className={primaryButton}>
                  Создать объявление бесплатно
                </Link>
                <a href="#example" className={secondaryButton}>
                  Посмотреть пример
                </a>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Без регистрации · бесплатно {freeQuota}
              </p>
            </div>

            <div aria-hidden className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <p className="text-xs text-slate-500">Пример составлен вручную — это не ответ ИИ</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Вы пишете</p>
              <dl className="mt-1 space-y-1 rounded-lg bg-white p-3 text-sm text-slate-800 ring-1 ring-slate-200">
                {inputRows.map((row) => (
                  <div key={row.label}>
                    <dt className="inline text-slate-500">{row.label}: </dt>
                    <dd className="inline">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Пример результата</p>
              <div className="mt-1 rounded-lg bg-white p-3 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600">{listing.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {listing.keywords.slice(0, 4).map((k) => (
                    <span key={k} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Что получается */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <SectionTitle
            id="what"
            title="Что вы получаете"
            lead="Готовые блоки объявления на английском. Их не нужно переводить — только проверить и вставить."
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-slate-900">{f.title}</p>
                <p className="mt-1 text-sm text-slate-600">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Как это работает */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <SectionTitle id="how" title="Как это работает" />
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-xl border border-slate-200 p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <p className="mt-3 font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Пример */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <SectionTitle
            id="example"
            title="Пример: было и стало"
            lead="Пример составлен вручную, чтобы показать формат результата, — это не ответ ИИ. Настоящий ответ для того же товара будет сформулирован по-своему."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <p className="text-sm font-semibold text-slate-900">Вы заполняете форму по-русски</p>
              <dl className="mt-4 space-y-3 text-sm">
                {inputRows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
                    <dd className="mt-0.5 text-slate-800">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div lang="en" className="rounded-2xl border border-indigo-200 bg-white p-5 sm:p-6">
              <p lang="ru" className="text-sm font-semibold text-slate-900">
                Получаете объявление на английском
              </p>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p lang="ru" className="text-xs font-medium text-slate-500">
                    Заголовок · {listing.title.length}/80
                  </p>
                  <p className="mt-0.5 font-semibold text-slate-900">{listing.title}</p>
                </div>
                <div>
                  <p lang="ru" className="text-xs font-medium text-slate-500">
                    Описание
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-slate-800">{listing.description}</p>
                </div>
                <div>
                  <p lang="ru" className="text-xs font-medium text-slate-500">
                    Характеристики
                  </p>
                  <table className="mt-1 w-full text-left">
                    <tbody>
                      {listing.confirmed_specs.map((s) => (
                        <tr key={s.name} className="border-t border-slate-100">
                          <th scope="row" className="py-1 pr-3 font-medium text-slate-600">
                            {s.name}
                          </th>
                          <td className="py-1 text-slate-800">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p lang="ru" className="text-xs font-medium text-slate-500">
                    Ключевые слова
                  </p>
                  <p className="mt-0.5 text-slate-800">{listing.keywords.join(", ")}</p>
                </div>
                <div lang="ru" className="rounded-lg bg-amber-50 p-3 text-amber-900">
                  <p className="text-xs font-semibold">Что стоит уточнить</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {listing.missing_details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Link href="/create" className={primaryButton}>
              Попробовать со своим товаром
            </Link>
          </div>
        </section>

        {/* Цены */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <SectionTitle id="pricing" title="Цены" lead="Сервис в бета-версии. Сейчас доступен только бесплатный пробный режим." />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-900">Пробный доступ</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">Бесплатно</p>
                <ul className="mt-4 flex-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  <li>{freeQuota}</li>
                  <li>Без регистрации и без банковской карты</li>
                  <li>Фото, редактирование и копирование результата</li>
                </ul>
                <Link href="/create" className={`${primaryButton} mt-6`}>
                  Попробовать бесплатно
                </Link>
              </div>

              <div className="flex flex-col rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/40 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">Пакет {PAID_PACK.generations} объявлений</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    Экспериментальная цена
                  </span>
                </div>
                <p className="mt-2 text-3xl font-bold text-slate-900">{PAID_PACK.price}</p>
                <p className="mt-1 text-sm text-slate-600">Разовая покупка, не подписка</p>
                <p className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                  <strong className="font-semibold text-slate-900">Оплата пока не подключена.</strong> Купить пакет сейчас
                  нельзя, и мы ничего не списываем. Мы проверяем, нужен ли он продавцам; цена может измениться.
                  {CONTACT_EMAIL && " Если пакет вам интересен — оставьте заявку, и мы напишем, если подключим оплату."}
                </p>
                <div className="mt-6 flex-1 content-end">
                  {CONTACT_EMAIL ? (
                    <MailLink topic="paid" className={`${secondaryButton} w-full`}>
                      Хочу пакет — оставить заявку
                    </MailLink>
                  ) : (
                    <p className="text-sm text-slate-500">Приём заявок скоро откроется.</p>
                  )}
                  {CONTACT_EMAIL && (
                    <p className="mt-2 text-center text-xs text-slate-500">Откроется письмо на {CONTACT_EMAIL}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Данные */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <SectionTitle id="privacy" title="Что происходит с вашими данными" />
          <ul className="mt-6 max-w-3xl list-disc space-y-2 pl-5 text-slate-700">
            <li>
              Текст и фото отправляются на наш сервер, а с него — в Claude API компании Anthropic, который и составляет
              объявление.
            </li>
            <li>
              У ListCraft Global нет базы данных: мы не сохраняем описания, фото и готовые объявления. С нашей
              стороны результат остаётся только в вашей вкладке браузера.
            </li>
            <li>
              Перед отправкой браузер уменьшает фото и пересохраняет его — при этом удаляются метаданные, в том числе
              геолокация. Если браузеру не удалось обработать фото, отправляется исходный файл.
            </li>
            <li>
              Для бесплатного лимита сервер считает запросы по IP-адресу. Счётчики хранятся только в памяти сервера и
              обнуляются при его перезапуске.
            </li>
            <li>
              В журналы сервера попадают только технические сведения — модель ИИ, число токенов, время ответа, было ли
              приложено фото, коды ошибок — без текста и фото. Хостинг-провайдер может вести стандартные журналы
              запросов (например, IP-адрес и время).
            </li>
            <li>
              Anthropic хранит данные из API ограниченное время по своим правилам и по умолчанию не использует их для
              обучения моделей —{" "}
              <a
                href="https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training"
                target="_blank"
                rel="noreferrer noopener"
                className="text-indigo-700 underline underline-offset-2"
              >
                подробнее у Anthropic
              </a>
              .
            </li>
            <li>Не указывайте в описании личные данные: телефоны, адреса, имена.</li>
          </ul>
        </section>

        {/* Вопросы */}
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <SectionTitle id="faq" title="Частые вопросы" />
            <div className="mt-6 max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200">
              {[
                {
                  q: "Для каких площадок подходит текст?",
                  a: "Объявление пишется на английском в формате, привычном для eBay, Etsy и Amazon. Перед публикацией сверьтесь с правилами конкретной площадки.",
                },
                {
                  q: "Не придумает ли ИИ лишнего?",
                  a: "ИИ получает инструкцию брать факты только из ваших данных и того, что явно видно на фото, а недостающее — перечислять в списке «Что стоит уточнить». Но ИИ может ошибаться, поэтому перечитайте текст перед публикацией: каждое поле можно отредактировать.",
                },
                {
                  q: "Обязательно ли фото?",
                  a: "Нет, достаточно названия товара. Фото помогает точнее описать цвет и внешний вид. Подходят JPEG, PNG и WebP до 5 МБ.",
                },
                {
                  q: "Нужна ли регистрация?",
                  a: `Нет. Бесплатно можно создать ${freeQuota}. Отсчёт идёт от первого запроса, а не от полуночи.`,
                },
                {
                  q: "Можно ли купить больше объявлений?",
                  a:
                    `Пока нет: оплата не подключена. Мы проверяем интерес к пакету ${PAID_PACK.generations} объявлений за ${PAID_PACK.price}. ` +
                    (CONTACT_EMAIL ? "Если он вам нужен, оставьте заявку в разделе «Цены»." : "Приём заявок скоро откроется."),
                },
              ].map((item) => (
                <details key={item.q} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden justify-between gap-4 font-medium text-slate-900">
                    {item.q}
                    <span aria-hidden className="text-slate-400 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Финальный призыв */}
        <section className="bg-indigo-600">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-2xl font-bold text-white">Попробуйте на своём товаре</p>
              <p className="mt-1 text-indigo-100">Без регистрации · бесплатно {freeQuota}</p>
            </div>
            <Link
              href="/create"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
            >
              Создать объявление
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
