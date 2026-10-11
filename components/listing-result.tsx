"use client";

import { useState, type ReactNode } from "react";
import { TITLE_MAX_LENGTH, type ListingOutput } from "@/lib/listing-schema";
import { CopyButton } from "./copy-button";

type Props = {
  listing: ListingOutput;
  isDemo: boolean;
};

const fieldClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

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
        <label htmlFor={id} className="text-sm font-semibold text-slate-900">
          {title}
        </label>
        <div className="flex items-center gap-2">
          {extra}
          {copyText !== undefined && <CopyButton text={copyText} />}
        </div>
      </div>
      {children}
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </section>
  );
}

/**
 * Результат генерации. Все поля редактируемые: пользователь правит текст
 * перед копированием. Исходные данные не изменяются — при новой генерации
 * компонент пересоздаётся (через key) с новыми значениями.
 */
export function ListingResult({ listing, isDemo }: Props) {
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [specs, setSpecs] = useState(() => specsToText(listing));
  const [keywords, setKeywords] = useState(() => listing.keywords.join(", "));
  const [missing, setMissing] = useState(() => listing.missing_details.join("\n"));

  const photoSpecs = listing.confirmed_specs.filter((s) => s.source === "photo");
  const titleTooLong = title.length > TITLE_MAX_LENGTH;

  const copyAll = [
    title.trim(),
    description.trim(),
    specs.trim() ? `Item specifics:\n${specs.trim()}` : "",
    keywords.trim() ? `Keywords: ${keywords.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-6">
      {isDemo && (
        <div role="note" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">ДЕМО — это не ответ ИИ</p>
          <p className="mt-1">
            Это статический пример, чтобы посмотреть интерфейс. Он не связан с введёнными вами данными.
            {process.env.NODE_ENV !== "production" && " Для настоящей генерации настройте ANTHROPIC_API_KEY."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Проверьте и при необходимости отредактируйте текст перед публикацией.</p>
        <CopyButton text={copyAll} label="Копировать всё" variant="primary" />
      </div>

      <Section
        id="result-title"
        title="Заголовок (Title)"
        copyText={title}
        extra={
          <span className={`text-xs ${titleTooLong ? "font-medium text-rose-600" : "text-slate-400"}`}>
            {title.length}/{TITLE_MAX_LENGTH}
          </span>
        }
        hint={titleTooLong ? "eBay не примет заголовок длиннее 80 символов — сократите его." : undefined}
      >
        <input id="result-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </Section>

      <Section id="result-description" title="Описание (Description)" copyText={description}>
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
            <span className="text-amber-700">
              Определено только по фото — проверьте перед публикацией: {photoSpecs.map((s) => s.name).join(", ")}.
            </span>
          ) : (
            "Только то, что вы указали сами или что явно видно на фото. Формат: «Название: значение», по одной на строку."
          )
        }
      >
        {listing.confirmed_specs.length === 0 && !specs ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
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

      <Section id="result-keywords" title="Ключевые слова для поиска" copyText={keywords} hint="Через запятую. Используйте в тегах или поле ключевых слов площадки.">
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
          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
            Основные данные указаны.
          </p>
        ) : (
          <textarea
            id="result-missing"
            rows={Math.min(8, Math.max(3, listing.missing_details.length + 1))}
            value={missing}
            onChange={(e) => setMissing(e.target.value)}
            className={`${fieldClass} resize-y border-amber-200 bg-amber-50/50`}
          />
        )}
      </Section>
    </div>
  );
}
