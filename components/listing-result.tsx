"use client";

import { useState, type ReactNode } from "react";
import { MARKETS, type ListingOutput, type Market } from "@/lib/listing-schema";
import { CopyButton } from "./copy-button";

type Props = {
  listing: ListingOutput;
  isDemo: boolean;
  market: Market;
};

/** Подписи, которые зависят от языка объявления. */
const TEXT = {
  global: {
    title: "Заголовок (Title)",
    description: "Описание (Description)",
    specsHeading: "Item specifics:",
    keywordsHeading: "Keywords:",
    keywordsHint: "Через запятую. Используйте в тегах или поле ключевых слов площадки.",
  },
  ru: {
    title: "Заголовок",
    description: "Описание",
    specsHeading: "Характеристики:",
    keywordsHeading: "Ключевые слова:",
    keywordsHint: "Через запятую. Так покупатели ищут товар — используйте эти слова в тегах площадки или в тексте объявления.",
  },
} satisfies Record<Market, Record<string, string>>;

const fieldClass =
  "block w-full rounded-xl border border-olive-900/15 bg-cream-50/70 px-3.5 py-2.5 text-sm text-olive-900 transition hover:border-olive-900/30 focus:border-olive-600/70 focus:bg-cream-50 focus:outline-none focus:ring-4 focus:ring-olive-600/15";

function specsToText(listing: ListingOutput) {
  return listing.confirmed_specs.map((s) => `${s.name}: ${s.value}`).join("\n");
}

function Section({
  id,
  title,
  hint,
  copyText,
  extra,
  children,
}: {
  id: string;
  title: string;
  hint?: ReactNode;
  copyText?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-olive-950">
          {title}
        </label>
        <div className="flex items-center gap-2">
          {extra}
          {copyText !== undefined && <CopyButton text={copyText} />}
        </div>
      </div>
      {children}
      {hint && <div className="text-xs text-olive-600">{hint}</div>}
    </section>
  );
}

/**
 * Результат генерации. Все поля редактируемые: пользователь правит текст
 * перед копированием. Исходные данные не изменяются — при новой генерации
 * компонент пересоздаётся (через key) с новыми значениями.
 */
export function ListingResult({ listing, isDemo, market }: Props) {
  const text = TEXT[market];
  const { titleMax, titleHint } = MARKETS[market];
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [specs, setSpecs] = useState(() => specsToText(listing));
  const [keywords, setKeywords] = useState(() => listing.keywords.join(", "));
  const [missing, setMissing] = useState(() => listing.missing_details.join("\n"));

  const photoSpecs = listing.confirmed_specs.filter((s) => s.source === "photo");
  const titleTooLong = title.length > titleMax;

  const copyAll = [
    title.trim(),
    description.trim(),
    specs.trim() ? `${text.specsHeading}\n${specs.trim()}` : "",
    keywords.trim() ? `${text.keywordsHeading} ${keywords.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-6">
      {isDemo && (
        <div role="note" className="rounded-2xl border-2 border-ochre-500 bg-ochre-100 p-4 text-sm text-ochre-800">
          <p className="font-display text-base font-bold">ДЕМО — это не ответ ИИ</p>
          <p className="mt-1">
            Это статический пример, чтобы посмотреть интерфейс. Он не связан с введёнными вами данными.
            {process.env.NODE_ENV !== "production" && " Для настоящей генерации настройте GROQ_API_KEY."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-olive-700">Проверьте и при необходимости отредактируйте текст перед публикацией.</p>
        <CopyButton text={copyAll} label="Копировать всё" variant="primary" />
      </div>

      <Section
        id="result-title"
        title={text.title}
        copyText={title}
        extra={
          <span className={`text-xs ${titleTooLong ? "font-medium text-rose-700" : "text-olive-600"}`}>
            {title.length}/{titleMax}
          </span>
        }
        hint={titleTooLong ? <span className="text-rose-700">{titleHint}</span> : undefined}
      >
        <input id="result-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </Section>

      <Section id="result-description" title={text.description} copyText={description}>
        <textarea
          id="result-description"
          rows={9}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${fieldClass} resize-y leading-relaxed`}
        />
      </Section>

      <Section
        id="result-specs"
        title="Подтверждённые характеристики"
        copyText={specs}
        hint={
          photoSpecs.length > 0 ? (
            <span className="font-medium text-ochre-800">
              Определено только по фото — проверьте перед публикацией: {photoSpecs.map((s) => s.name).join(", ")}.
            </span>
          ) : (
            "Только то, что вы указали сами или что явно видно на фото. Формат: «Название: значение», по одной на строку."
          )
        }
      >
        {listing.confirmed_specs.length === 0 && !specs ? (
          <p className="rounded-xl border border-dashed border-olive-900/20 p-3 text-sm text-olive-600">
            Подтверждённых характеристик нет. Заполните больше полей формы.
          </p>
        ) : (
          <textarea
            id="result-specs"
            rows={Math.min(10, Math.max(3, listing.confirmed_specs.length + 1))}
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            className={`${fieldClass} resize-y font-mono text-[13px]`}
          />
        )}
      </Section>

      <Section id="result-keywords" title="Ключевые слова для поиска" copyText={keywords} hint={text.keywordsHint}>
        <textarea
          id="result-keywords"
          rows={3}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className={`${fieldClass} resize-y`}
        />
      </Section>

      <Section
        id="result-missing"
        title="Что стоит уточнить"
        copyText={missing}
        hint="ИИ отметил, что этих данных не хватает. Добавьте их в форму и создайте объявление заново, чтобы оно стало точнее."
      >
        {listing.missing_details.length === 0 && !missing ? (
          <p className="rounded-xl border border-dashed border-olive-900/20 p-3 text-sm text-olive-600">
            Основные данные указаны.
          </p>
        ) : (
          <textarea
            id="result-missing"
            rows={Math.min(8, Math.max(3, listing.missing_details.length + 1))}
            value={missing}
            onChange={(e) => setMissing(e.target.value)}
            className={`${fieldClass} resize-y border-ochre-500/40 bg-ochre-100/60`}
          />
        )}
      </Section>
    </div>
  );
}
