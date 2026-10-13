"use client";

import type { ReactNode } from "react";
import { CONDITION_OPTIONS, FIELD_LIMITS, MARKETS, type ConditionValue, type Market } from "@/lib/listing-schema";

export type FormValues = {
  market: Market;
  productName: string;
  brand: string;
  condition: ConditionValue;
  dimensions: string;
  color: string;
  material: string;
  details: string;
};

export const EMPTY_FORM: FormValues = {
  market: "global",
  productName: "",
  brand: "",
  condition: "",
  dimensions: "",
  color: "",
  material: "",
  details: "",
};

type TextFieldName = Exclude<keyof FormValues, "condition" | "market">;

type Props = {
  values: FormValues;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (values: FormValues) => void;
};

const inputClass =
  "block w-full rounded-xl border bg-cream-50/70 px-3.5 py-2.5 text-sm text-olive-900 transition placeholder:text-olive-500/80 hover:border-olive-900/30 focus:bg-cream-50 focus:outline-none focus:ring-4 focus:ring-olive-600/15 disabled:cursor-not-allowed disabled:opacity-60";

function borderFor(error?: string) {
  return error ? "border-rose-600/60 focus:border-rose-600" : "border-olive-900/15 focus:border-olive-600/70";
}

function FieldShell({
  id,
  label,
  hint,
  required,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  counter?: { length: number; max: number };
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-olive-900">
          {label}
          {required ? <span className="ml-0.5 text-olive-600">*</span> : null}
        </label>
        {!required && <span className="text-xs text-olive-600">необязательно</span>}
      </div>
      {children}
      <div className="mt-1 flex justify-between gap-2 text-xs">
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-rose-700">
            {error}
          </p>
        ) : (
          <p className="text-olive-600">{hint}</p>
        )}
        {counter && counter.length > counter.max * 0.8 && (
          <span className={counter.length > counter.max ? "text-rose-700" : "text-olive-600"}>
            {counter.length}/{counter.max}
          </span>
        )}
      </div>
    </div>
  );
}

/** Переключатель «для каких площадок»: от него зависят язык и правила объявления. */
function MarketPicker({
  value,
  disabled,
  error,
  onChange,
}: {
  value: Market;
  disabled: boolean;
  error?: string;
  onChange: (market: Market) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-olive-900">Где будете продавать?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(MARKETS) as Market[]).map((key) => {
          const market = MARKETS[key];
          return (
            <label
              key={key}
              className="group relative flex cursor-pointer flex-col rounded-2xl border border-olive-900/15 bg-cream-50/70 px-4 py-3 transition hover:border-olive-900/30 has-checked:border-olive-600/60 has-checked:bg-olive-600/10 has-checked:ring-4 has-checked:ring-olive-600/10 has-focus-visible:ring-4 has-focus-visible:ring-olive-600/30 has-disabled:cursor-not-allowed has-disabled:opacity-60"
            >
              <input
                type="radio"
                name="market"
                value={key}
                checked={value === key}
                disabled={disabled}
                onChange={() => onChange(key)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-olive-950">{market.label}</span>
                <span
                  aria-hidden
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-olive-900/30 group-has-checked:border-olive-600 group-has-checked:bg-olive-600"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cream-100 opacity-0 group-has-checked:opacity-100" />
                </span>
              </span>
              <span className="mt-0.5 text-xs text-olive-700">{market.platforms}</span>
              <span className="mt-2 inline-flex w-fit rounded-full bg-cream-50/70 px-2 py-0.5 text-xs font-medium text-olive-700 group-has-checked:bg-olive-600 group-has-checked:text-cream-100">
                Объявление {market.languageLabel}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function fieldHelpers({ values, errors, disabled, onChange }: Props) {
  const set = (name: keyof FormValues, value: string) => onChange({ ...values, [name]: value });

  const text = (name: TextFieldName, label: string, placeholder: string, hint?: string, required = false) => (
    <FieldShell
      id={name}
      label={label}
      hint={hint}
      required={required}
      error={errors[name]}
      counter={{ length: values[name].length, max: FIELD_LIMITS[name] }}
    >
      <input
        id={name}
        name={name}
        type="text"
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={FIELD_LIMITS[name] + 20}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        className={`${inputClass} ${borderFor(errors[name])}`}
      />
    </FieldShell>
  );

  return { set, text };
}

/** Шаг 1: что за товар — название и описание своими словами. */
export function ProductFields(props: Props) {
  const { values, errors, disabled } = props;
  const { set, text } = fieldHelpers(props);

  return (
    <div className="space-y-5">
      {text(
        "productName",
        "Название или тип товара",
        "Например: кожаная сумка через плечо",
        "Главное поле. Остальное — по возможности.",
        true,
      )}

      <FieldShell
        id="details"
        label="Описание своими словами"
        error={errors.details}
        hint="Особенности, комплектация, дефекты — можно коротко и с ошибками"
        counter={{ length: values.details.length, max: FIELD_LIMITS.details }}
      >
        <textarea
          id="details"
          name="details"
          rows={4}
          value={values.details}
          onChange={(e) => set("details", e.target.value)}
          placeholder="Например: носила один сезон, есть небольшая потёртость на ремне, внутри два кармана"
          disabled={disabled}
          maxLength={FIELD_LIMITS.details + 100}
          aria-invalid={errors.details ? true : undefined}
          className={`${inputClass} ${borderFor(errors.details)} resize-y`}
        />
      </FieldShell>
    </div>
  );
}

/** Шаг 2: для каких площадок и какие характеристики указать. */
export function ListingSettings(props: Props) {
  const { values, errors, disabled, onChange } = props;
  const { set, text } = fieldHelpers(props);

  return (
    <div className="space-y-5">
      <MarketPicker
        value={values.market}
        disabled={disabled}
        error={errors.market}
        onChange={(market) => onChange({ ...values, market })}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {text("brand", "Бренд", "Например: Zara", "Только если знаете точно")}

        <FieldShell id="condition" label="Состояние" error={errors.condition} hint="Если не выбрать, ИИ не будет его указывать">
          <select
            id="condition"
            name="condition"
            value={values.condition}
            onChange={(e) => set("condition", e.target.value)}
            disabled={disabled}
            className={`${inputClass} ${borderFor(errors.condition)}`}
          >
            {CONDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldShell>

        {text("color", "Цвет", "Например: коричневый")}
        {text("material", "Материал", "Например: натуральная кожа")}
      </div>

      {text("dimensions", "Размеры или параметры", "Например: 25 × 18 × 7 см, размер M, 128 ГБ", "Числа и единицы перенесём без изменений")}
    </div>
  );
}
