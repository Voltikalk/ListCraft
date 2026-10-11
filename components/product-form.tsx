"use client";

import type { ReactNode } from "react";
import { CONDITION_OPTIONS, FIELD_LIMITS, type ConditionValue } from "@/lib/listing-schema";

export type FormValues = {
  productName: string;
  brand: string;
  condition: ConditionValue;
  dimensions: string;
  color: string;
  material: string;
  details: string;
};

export const EMPTY_FORM: FormValues = {
  productName: "",
  brand: "",
  condition: "",
  dimensions: "",
  color: "",
  material: "",
  details: "",
};

type TextFieldName = Exclude<keyof FormValues, "condition">;

type Props = {
  values: FormValues;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (values: FormValues) => void;
  photoSlot: ReactNode;
};

const inputClass =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:bg-slate-50 disabled:text-slate-500";

function borderFor(error?: string) {
  return error ? "border-rose-400 focus:border-rose-500" : "border-slate-300 focus:border-indigo-500";
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
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
        {!required && <span className="text-xs text-slate-400">необязательно</span>}
      </div>
      {children}
      <div className="mt-1 flex justify-between gap-2 text-xs">
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-rose-600">
            {error}
          </p>
        ) : (
          <p className="text-slate-500">{hint}</p>
        )}
        {counter && counter.length > counter.max * 0.8 && (
          <span className={counter.length > counter.max ? "text-rose-600" : "text-slate-400"}>
            {counter.length}/{counter.max}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProductForm({ values, errors, disabled, onChange, photoSlot }: Props) {
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

  return (
    <div className="space-y-5">
      {text(
        "productName",
        "Название или тип товара",
        "Например: кожаная сумка через плечо",
        "Главное поле. Остальное — по возможности.",
        true,
      )}

      {photoSlot}

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

      <FieldShell
        id="details"
        label="Дополнительное описание"
        error={errors.details}
        hint="Особенности, комплектация, дефекты — своими словами"
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
