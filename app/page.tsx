import Link from "next/link";
import { ExampleTabs } from "@/components/example-tabs";
import CRTWarp from "@/components/reactbits/CRTWarp";
import GradientText from "@/components/reactbits/GradientText";
import { LogoMarquee } from "@/components/logo-marquee";
import PixelCard from "@/components/reactbits/PixelCard";
import ShinyText from "@/components/reactbits/ShinyText";
import TextType from "@/components/reactbits/TextType";
import { StarCta } from "@/components/star-cta";
import { card, GlowCard, MailLink, primaryButton, secondaryButton, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { DEMO_LISTINGS, EXAMPLE_INPUT } from "@/lib/demo-listing";
import { CONDITION_OPTIONS, MARKETS, type Market } from "@/lib/listing-schema";
import { getLimits } from "@/lib/server/rate-limit";
import { getRedisConfig } from "@/lib/server/shared-rate-limit";
import { CONTACT_EMAIL, listingsCount, PAID_PACK, TURNSTILE_SITE_KEY } from "@/lib/site";

const MARKET_CARDS: { market: Market; code: string; color: string; points: string[] }[] = [
  {
    market: "ru",
    code: "RU",
    color: "rgb(96 108 56)",
    points: [
      "Черновые заметки превращаются в грамотный текст на русском",
      `Заголовок до ${MARKETS.ru.titleMax} символов — лимит Авито (у Wildberries — 60)`,
      "Характеристики и поисковые запросы на русском",
    ],
  },
  {
    market: "global",
    code: "EN",
    color: "rgb(188 108 37)",
    points: [
      "Перевод с русского на понятный английский",
      `Заголовок до ${MARKETS.global.titleMax} символов — лимит eBay`,
      "Числа и единицы сохраняются, при необходимости — с пересчётом в дюймы",
    ],
  },
];

const FEATURES = [
  {
    title: "Заголовок",
    text: "ИИ старается уложиться в лимит площадки: 50 символов для Авито, 80 для eBay. Рядом с полем есть счётчик.",
    icon: "M4 6h16M4 12h10",
  },
  {
    title: "Описание",
    text: "Короткие абзацы без рекламных преувеличений — на русском или на английском.",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h9",
  },
  {
    title: "Характеристики",
    text: "Факты из вашего текста или с фото. Всё, что взято с фото, помечено отдельно.",
    icon: "M5 6h2M5 12h2M5 18h2M10 6h9M10 12h9M10 18h9",
  },
  {
    title: "Ключевые слова",
    text: "Поисковые фразы, которые набирают покупатели, — для тегов и текста объявления.",
    icon: "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13ZM15.5 15.5 20 20",
  },
  {
    title: "Что уточнить",
    text: "Список на русском: каких данных не хватает, чтобы объявление было полнее.",
    icon: "M12 8v5M12 16.5v.5M4.5 19.5h15L12 4.5z",
  },
];

const STEPS = [
  {
    title: "Выберите площадки и опишите товар",
    text: "Российские площадки или зарубежные. Обязательно только название, остальное — если знаете. Фото — по желанию.",
  },
  {
    title: "ИИ составит объявление",
    text: "Заголовок, описание, характеристики и ключевые слова на нужном языке. ИИ получает инструкцию не додумывать недостающее, а перечислить его отдельно.",
  },
  {
    title: "Проверьте и скопируйте",
    text: "Каждое поле можно отредактировать и скопировать — по отдельности или всё сразу — и вставить на площадку.",
  },
];

const GRADIENT = ["#fefae0", "#d3d9ae", "#b5c07e", "#fefae0"];

/** Второстепенная кнопка на оливковом фоне (первый экран). */
const onOliveSecondary = "inline-flex items-center justify-center gap-2 rounded-full border border-cream-100/40 px-6 py-3 text-base font-semibold text-cream-100 transition hover:bg-cream-100/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cream-100 focus-visible:ring-offset-2 focus-visible:ring-offset-olive-600";

const SECTION_TOTAL = 7;

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

/** Заголовок секции в стиле постера: тонкая линия, подпись и номер «01 / 07». */
function SectionTitle({
  id,
  num,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  num: number;
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="reveal">
      <div className="flex items-center justify-between gap-4 border-t border-olive-900/20 pt-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-olive-600">
        <span>{eyebrow}</span>
        <span aria-hidden className="tabular-nums">
          {String(num).padStart(2, "0")} / {String(SECTION_TOTAL).padStart(2, "0")}
        </span>
      </div>
      <h2
        id={id}
        className="font-display mt-8 max-w-3xl scroll-mt-24 text-3xl leading-[1.05] font-bold tracking-[-0.03em] text-olive-700 sm:text-5xl"
      >
        {title}
      </h2>
      {lead && <p className="mt-5 max-w-2xl text-base leading-relaxed text-olive-800">{lead}</p>}
    </div>
  );
}

function CheckIcon({ className = "bg-olive-600 text-cream-100" }: { className?: string }) {
  return (
    <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${className}`}>
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-olive-600/25 bg-olive-600/10 px-2.5 py-0.5 text-xs text-olive-800">
      {children}
    </span>
  );
}

/** Пример результата для одного рынка. Текст составлен вручную (см. lib/demo-listing.ts). */
function ExampleListing({ market }: { market: Market }) {
  const listing = DEMO_LISTINGS[market];
  const { titleMax } = MARKETS[market];
  const label = "text-xs font-medium uppercase tracking-wider text-olive-600";
  return (
    <div lang={market === "ru" ? "ru" : "en"} className="space-y-5 text-sm">
      <div>
        <p lang="ru" className={label}>
          Заголовок · {listing.title.length}/{titleMax}
        </p>
        <p className="mt-1 text-base font-semibold text-olive-950">{listing.title}</p>
      </div>
      <div>
        <p lang="ru" className={label}>
          Описание
        </p>
        <p className="mt-1 whitespace-pre-line leading-relaxed text-olive-800">{listing.description}</p>
      </div>
      <div>
        <p lang="ru" className={label}>
          Характеристики
        </p>
        <table className="mt-1 w-full text-left">
          <tbody>
            {listing.confirmed_specs.map((s) => (
              <tr key={s.name} className="border-t border-olive-900/10">
                <th scope="row" className="py-2 pr-3 font-medium text-olive-600">
                  {s.name}
                </th>
                <td className="py-2 text-olive-900">{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p lang="ru" className={label}>
          Ключевые слова
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {listing.keywords.map((k) => (
            <Chip key={k}>{k}</Chip>
          ))}
        </div>
      </div>
      <div lang="ru" className="rounded-2xl border border-ochre-500/40 bg-ochre-100 p-4 text-ochre-800">
        <p className="text-xs font-semibold uppercase tracking-wider">Что стоит уточнить</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {listing.missing_details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Окно-иллюстрация на первом экране. Содержимое составлено вручную и так подписано. */
function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl motion-safe:animate-rise [--rise-delay:420ms] sm:mt-20">
      <div className="rounded-[1.75rem] bg-cream-100 p-2 text-left text-olive-950 shadow-[0_40px_80px_-40px_rgb(31_36_18/0.7)]">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-olive-600/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-olive-600/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-olive-600/25" />
          </div>
          <p className="text-[11px] font-medium text-olive-700">Пример составлен вручную — это не ответ ИИ</p>
        </div>
        <div aria-hidden className="grid gap-2 md:grid-cols-[1fr_1.35fr]">
          <div className="rounded-[1.25rem] border border-olive-900/10 bg-cream-50/70 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-olive-600">Вы пишете</p>
            <p className="mt-3 text-sm leading-relaxed text-olive-800">
              <TextType
                text={`${EXAMPLE_INPUT.productName}. ${EXAMPLE_INPUT.details}`}
                initialDelay={900}
                variableSpeed={{ min: 25, max: 70 }}
                pauseDuration={4000}
                deletingSpeed={12}
                startOnVisible
                cursorClassName="text-olive-600"
              />
            </p>
          </div>
          <div className="grid gap-2">
            {(["ru", "global"] as const).map((market, i) => (
              <div
                key={market}
                className={`rounded-[1.25rem] border border-olive-900/10 bg-cream-50/70 p-5 motion-safe:animate-rise ${i ? "[--rise-delay:900ms]" : "[--rise-delay:700ms]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-olive-600">{MARKETS[market].platforms}</p>
                  <p className="text-xs tabular-nums text-olive-600">
                    {DEMO_LISTINGS[market].title.length}/{MARKETS[market].titleMax}
                  </p>
                </div>
                <p className="mt-2 text-[15px] font-semibold text-olive-950">{DEMO_LISTINGS[market].title}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-olive-600/15">
                  <div
                    className="h-full rounded-full bg-olive-600"
                    style={{ width: `${Math.min(100, (DEMO_LISTINGS[market].title.length / MARKETS[market].titleMax) * 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {DEMO_LISTINGS[market].keywords.slice(0, 3).map((k) => (
                    <Chip key={k}>{k}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Текст зависит от настроек сервера (собирается при сборке страницы). */
function privacyItems(): string[] {
  const counters = getRedisConfig()
    ? "Счётчики хранятся в базе Upstash Redis и удаляются не позже чем через сутки."
    : "Счётчики хранятся только в памяти сервера и обнуляются при его перезапуске.";
  return [
    "Текст и фото отправляются на наш сервер, а с него — в Groq API (модель Qwen), который и составляет объявление.",
    "Мы не сохраняем описания, фото и готовые объявления. С нашей стороны результат остаётся только в вашей вкладке браузера.",
    "Перед отправкой браузер уменьшает фото и пересохраняет его — при этом удаляются метаданные, в том числе геолокация. Если браузеру не удалось обработать фото, отправляется исходный файл.",
    `Для бесплатного лимита сервер считает запросы с вашего IP-адреса. Сам адрес в счётчиках не хранится — только его хеш, по которому адрес нельзя просто прочитать. ${counters}`,
    ...(TURNSTILE_SITE_KEY
      ? [
          "Чтобы отсеивать ботов, форма использует Cloudflare Turnstile: скрипт Cloudflare проверяет браузер и обычно не требует от вас никаких действий.",
        ]
      : []),
    "В журналы сервера попадают только технические сведения — модель ИИ, выбранный рынок, число токенов, время ответа, было ли приложено фото, коды ошибок — без текста и фото. Хостинг-провайдер может вести стандартные журналы запросов (например, IP-адрес и время).",
  ];
}

export default function Home() {
  const freeQuota = `${listingsCount(getLimits().perDay)} за 24 часа`;
  const inputRows = exampleInputRows();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Первый экран */}
        <section className="relative isolate overflow-hidden bg-olive-600 text-cream-100">
          <div aria-hidden className="absolute inset-0 -z-10">
            <CRTWarp
              color="#b5c07e"
              backgroundColor="#606c38"
              speed={0.4}
              curvature={0.25}
              scanlineStrength={0.3}
              scanlineFrequency={200}
              waveAmplitude={0.3}
              waveFrequency={2.5}
              bloom={1.2}
              bloomRadius={1}
              noise={0.05}
              vignette={0.35}
              brightness={0.75}
              rgbShift={0.006}
              mouseStrength={0.4}
              dpr={1}
              fps={30}
            />
            {/* Притушить узор под текстом и плавно перейти в однотонный низ секции. */}
            <div className="absolute inset-0 bg-olive-600/30" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-b from-transparent to-olive-600" />
          </div>

          <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14 sm:pb-28">
            <div className="flex items-center justify-between gap-4 border-b border-cream-100/25 pb-3 motion-safe:animate-rise text-[11px] font-semibold uppercase tracking-[0.25em]">
              <ShinyText text="Авито · Ozon · Wildberries · eBay · Etsy · Amazon" color="#b5c07e" shineColor="#fefae0" speed={3} />
              <span aria-hidden className="hidden text-cream-100/70 sm:inline">
                RU / EN
              </span>
            </div>
            <h1 className="font-display mt-12 max-w-5xl motion-safe:animate-rise [--rise-delay:90ms] text-[2.4rem] leading-[1] font-bold tracking-[-0.04em] text-cream-100 sm:mt-16 sm:text-7xl lg:text-[5.25rem]">
              Объявление для маркетплейса{" "}
              <GradientText colors={GRADIENT} animationSpeed={7} className="pb-[0.08em]">
                из пары фраз о товаре
              </GradientText>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-relaxed text-cream-100/85 motion-safe:animate-rise [--rise-delay:180ms] sm:text-lg">
              Опишите товар по-русски своими словами и, если хотите, добавьте фото. ListCraft Global составит заголовок,
              описание, характеристики и ключевые слова — на русском для Авито, Ozon и Wildberries или на английском для
              eBay, Etsy и Amazon.
            </p>
            <div className="mt-9 flex flex-col gap-3 motion-safe:animate-rise [--rise-delay:270ms] sm:flex-row">
              <StarCta href="/create">
                Создать объявление бесплатно
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </StarCta>
              <a href="#example" className={onOliveSecondary}>
                Посмотреть пример
              </a>
            </div>
            <p className="mt-5 text-sm text-cream-100/75 motion-safe:animate-rise [--rise-delay:330ms]">Без регистрации · бесплатно {freeQuota}</p>

            <HeroPreview />
          </div>
        </section>

        {/* Площадки */}
        <section aria-label="Площадки, под которые пишутся объявления" className="border-y border-olive-900/10 bg-cream-50/70 py-6">
          <p className="mx-auto mb-4 max-w-6xl px-4 text-center text-[11px] font-semibold tracking-[0.25em] text-olive-600 uppercase sm:px-6">
            Объявления под правила площадок
          </p>
          <LogoMarquee />
          <p className="mx-auto mt-4 max-w-6xl px-4 text-center text-[11px] text-olive-500 sm:px-6">
            Названия и логотипы — товарные знаки их владельцев. ListCraft не связан с этими площадками и не публикует объявления за вас.
          </p>
        </section>

        {/* Два рынка */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle
            id="markets"
            num={1}
            eyebrow="Два рынка"
            title="Продаёте в России или за рубежом"
            lead="Перед созданием объявления выберите площадки — от этого зависят язык текста и правила оформления."
          />
          <div className="reveal mt-10 grid gap-4 md:grid-cols-2">
            {MARKET_CARDS.map(({ market, code, color, points }) => (
              <GlowCard key={market} color={color} className="p-7 transition-transform duration-300 hover:-translate-y-1 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold tracking-tight text-olive-950">{MARKETS[market].label}</p>
                    <p className="mt-1 text-sm text-olive-700">{MARKETS[market].platforms}</p>
                  </div>
                  <span aria-hidden className="font-display text-4xl font-bold tracking-tight text-olive-600">
                    {code}
                  </span>
                </div>
                <span className="mt-5 inline-flex rounded-full border border-olive-900/15 bg-olive-600/10 px-3 py-1 text-xs font-medium text-olive-900">
                  Объявление {MARKETS[market].languageLabel}
                </span>
                <ul className="mt-6 space-y-3 text-sm text-olive-800">
                  {points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <CheckIcon />
                      {point}
                    </li>
                  ))}
                </ul>
              </GlowCard>
            ))}
          </div>
        </section>

        {/* Что получается */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle
            id="what"
            num={2}
            eyebrow="Результат"
            title="Что вы получаете"
            lead="Готовые блоки объявления — их нужно только проверить и вставить на площадку."
          />
          <ul className="reveal mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className={i < 2 ? "lg:col-span-3" : i === FEATURES.length - 1 && FEATURES.length % 2 ? "sm:col-span-2 lg:col-span-2" : "lg:col-span-2"}
              >
                <GlowCard className="h-full p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-7">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-olive-600 text-cream-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d={f.icon} />
                    </svg>
                  </span>
                  <p className="mt-5 text-lg font-semibold text-olive-950">{f.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-olive-700">{f.text}</p>
                </GlowCard>
              </li>
            ))}
          </ul>
        </section>

        {/* Как это работает */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle id="how" num={3} eyebrow="Три шага" title="Как это работает" />
          <ol className="reveal mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className={`${card} relative overflow-hidden p-7 transition-transform duration-300 hover:-translate-y-1`}>
                <span aria-hidden className="font-display text-5xl font-bold tracking-tight text-olive-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-5 text-lg font-semibold text-olive-950">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-olive-700">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Пример */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle
            id="example"
            num={4}
            eyebrow="Пример"
            title="Было и стало"
            lead="Пример составлен вручную, чтобы показать формат результата, — это не ответ ИИ. Настоящий ответ для того же товара будет сформулирован по-своему."
          />
          <div className="reveal mt-10 grid gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className={`${card} p-6 sm:p-7`}>
              <p className="text-sm font-semibold text-olive-950">Вы заполняете форму по-русски</p>
              <dl className="mt-5 space-y-4 text-sm">
                {inputRows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs font-medium uppercase tracking-wider text-olive-600">{row.label}</dt>
                    <dd className="mt-1 text-olive-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <GlowCard className="p-6 sm:p-7">
              <p className="text-sm font-semibold text-olive-950">Получаете готовое объявление</p>
              <div className="mt-4">
                <ExampleTabs
                  tabs={[
                    { key: "ru", label: "Авито, Ozon, WB", panel: <ExampleListing market="ru" /> },
                    { key: "global", label: "eBay, Etsy, Amazon", panel: <ExampleListing market="global" /> },
                  ]}
                />
              </div>
            </GlowCard>
          </div>
          <div className="mt-10">
            <Link href="/create" className={`group ${primaryButton}`}>
              Попробовать со своим товаром
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </section>

        {/* Цены */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle
            id="pricing"
            num={5}
            eyebrow="Цены"
            title="Сколько стоит"
            lead="Сервис в бета-версии. Сейчас доступен только бесплатный пробный режим."
          />
          <div className="reveal mt-10 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            {/* Бесплатный режим — основной и единственный работающий вариант. */}
            <PixelCard
              theme="dark"
              colors={["#fefae0", "#d3d9ae", "#b5c07e"]}
              glowColor="#b5c07e"
              gap={7}
              speed={30}
              opacity={0.5}
              fade={0.75}
              introDelay={250}
              className="flex flex-col bg-olive-700 p-7 text-cream-100 shadow-panel sm:p-9"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-cream-200">Пробный доступ</p>
                <span className="inline-flex items-center gap-2 rounded-full bg-cream-100/10 px-3 py-1 text-xs font-medium text-cream-100 ring-1 ring-cream-100/25">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-olive-300" />
                  Работает сейчас
                </span>
              </div>
              <p className="font-display mt-5 text-4xl font-bold tracking-[-0.04em] text-cream-50 sm:text-5xl lg:text-6xl">Бесплатно</p>
              <div aria-hidden className="my-7 h-px bg-cream-100/15" />
              <ul className="flex-1 space-y-3.5 text-sm text-cream-100/90 sm:text-base">
                {[freeQuota, "Без регистрации и без банковской карты", "Оба рынка, фото, редактирование и копирование"].map(
                  (item) => (
                    <li key={item} className="flex gap-3">
                      <CheckIcon className="bg-cream-100 text-olive-700" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
              <Link
                href="/create"
                className="group mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-cream-100 px-6 py-3 text-base font-semibold text-olive-800 transition hover:bg-cream-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cream-100 focus-visible:ring-offset-2 focus-visible:ring-offset-olive-700"
              >
                Попробовать бесплатно
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </PixelCard>

            {/* Платный пакет — только проверка спроса, оплаты нет. */}
            <PixelCard
              theme="light"
              colors={["#bc6c25", "#d9a46b", "#95a256"]}
              glowColor="#bc6c25"
              gap={8}
              speed={20}
              opacity={0.35}
              fade={0.85}
              intro={false}
              className="flex flex-col border border-dashed border-olive-900/20 bg-cream-50/70 p-7 sm:p-9"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-olive-900">Пакет {PAID_PACK.generations} объявлений</p>
                <span className="rounded-full border border-ochre-500/40 bg-ochre-100 px-3 py-1 text-xs font-medium text-ochre-800">
                  Экспериментальная цена
                </span>
              </div>
              <p className="font-display mt-5 text-4xl font-bold tracking-[-0.04em] text-olive-800 sm:text-5xl lg:text-6xl">{PAID_PACK.price}</p>
              <p className="mt-2 text-sm text-olive-600">Разовая покупка, не подписка</p>
              <div className="mt-7 flex gap-3 rounded-2xl border border-ochre-500/25 bg-ochre-100/50 p-4 text-sm leading-relaxed text-olive-800">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ochre-500" />
                <p>
                  <strong className="font-semibold text-olive-950">Оплата пока не подключена.</strong> Купить пакет сейчас нельзя,
                  и мы ничего не списываем. Мы проверяем, нужен ли он продавцам; цена может измениться.
                  {CONTACT_EMAIL && " Если пакет вам интересен — оставьте заявку, и мы напишем, если подключим оплату."}
                </p>
              </div>
              <div className="mt-7 flex-1 content-end">
                {CONTACT_EMAIL ? (
                  <MailLink topic="paid" className={`${secondaryButton} w-full`}>
                    Хочу пакет — оставить заявку
                  </MailLink>
                ) : (
                  <p className="text-sm text-olive-600">Приём заявок скоро откроется.</p>
                )}
                {CONTACT_EMAIL && <p className="mt-2 text-center text-xs text-olive-600">Откроется письмо на {CONTACT_EMAIL}</p>}
              </div>
            </PixelCard>
          </div>
        </section>

        {/* Данные */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle id="privacy" num={6} eyebrow="Приватность" title="Что происходит с вашими данными" />
          <ul className={`${card} reveal mt-10 grid gap-x-10 gap-y-5 p-6 text-sm leading-relaxed text-olive-800 sm:p-8 md:grid-cols-2`}>
            {privacyItems().map((item) => (
              <li key={item} className="flex gap-3">
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
            <li className="flex gap-3">
              <CheckIcon />
              <span>
                Groq по умолчанию не хранит запросы к API; для диагностики сбоев и проверки злоупотреблений может временно
                сохранять их до 30 дней —{" "}
                <a
                  href="https://console.groq.com/docs/your-data"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-olive-700 underline underline-offset-2 hover:text-olive-900"
                >
                  подробнее у Groq
                </a>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <CheckIcon />
              <span>Не указывайте в описании личные данные: телефоны, адреса, имена.</span>
            </li>
          </ul>
        </section>

        {/* Вопросы */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle id="faq" num={7} eyebrow="Вопросы" title="Частые вопросы" />
          <div className={`${card} reveal mt-10 max-w-3xl divide-y divide-olive-900/10`}>
            {[
              {
                q: "Для каких площадок подходит текст?",
                a: "Для российских — Авито, Ozon, Wildberries и похожих: объявление пишется на русском. Для зарубежных — eBay, Etsy, Amazon и похожих: на английском. Площадки выбираются в форме. Перед публикацией сверьтесь с правилами конкретной площадки.",
              },
              {
                q: "Зачем сервис, если я и так пишу по-русски?",
                a: "Чтобы не собирать объявление вручную: из коротких заметок ИИ составит связный заголовок под лимит площадки, описание, список характеристик и поисковые фразы — и подскажет, каких данных не хватает.",
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
                a: `Нет. Бесплатно можно создать ${freeQuota} — для любого из рынков. Отсчёт идёт от первого запроса, а не от полуночи.`,
              },
              {
                q: "Можно ли купить больше объявлений?",
                a:
                  `Пока нет: оплата не подключена. Мы проверяем интерес к пакету ${PAID_PACK.generations} объявлений за ${PAID_PACK.price}. ` +
                  (CONTACT_EMAIL ? "Если он вам нужен, оставьте заявку в разделе «Цены»." : "Приём заявок скоро откроется."),
              },
            ].map((item) => (
              <details key={item.q} className="faq group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg font-medium text-olive-900 transition hover:text-olive-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-olive-900/15 text-olive-700 transition group-open:rotate-45 group-open:border-olive-600/40 group-open:bg-olive-600/10 group-open:text-olive-600"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 pr-10 text-sm leading-relaxed text-olive-700">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Финальный призыв */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="reveal relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-olive-600 px-6 py-16 text-cream-100 sm:px-12 sm:py-20">
            <div aria-hidden className="bg-grid bg-grid-light absolute inset-0 -z-10" />
            <p className="font-display max-w-3xl text-3xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-6xl">
              Попробуйте на своём товаре
            </p>
            <p className="mt-5 text-cream-100/80">Без регистрации · бесплатно {freeQuota}</p>
            <StarCta href="/create" className="mt-8">
              Создать объявление
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </StarCta>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
