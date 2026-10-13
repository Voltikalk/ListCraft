"use client";

import { useRef, useState, type DragEvent } from "react";
/* eslint-disable @next/next/no-img-element -- превью локального blob:, оптимизация next/image не нужна */

type Props = {
  previewUrl: string | null;
  processing: boolean;
  disabled: boolean;
  error: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
};

export function PhotoUpload({ previewUrl, processing, disabled, error, onSelect, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onSelect(file);
    if (inputRef.current) inputRef.current.value = ""; // позволяет выбрать тот же файл повторно
  };

  const locked = disabled || processing;
  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (!locked) setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!locked) pick(e.dataTransfer.files);
    },
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-olive-900">Фото товара</span>
        <span className="text-xs text-olive-600">необязательно · JPEG, PNG, WebP до 5 МБ</span>
      </div>

      {previewUrl ? (
        <div
          {...dropHandlers}
          className={`flex items-center gap-4 rounded-2xl border p-3 transition ${
            dragOver ? "border-olive-600 bg-olive-600/10" : "border-olive-900/15 bg-cream-50/70"
          }`}
        >
          <img
            src={previewUrl}
            alt="Превью загруженного фото"
            className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-olive-900/10 sm:h-24 sm:w-24"
          />
          <div className="min-w-0 flex-1 text-sm text-olive-700">
            <p className="font-medium text-olive-900">{processing ? "Обрабатываем новое фото…" : "Фото добавлено"}</p>
            <p className="mt-0.5 text-xs text-olive-600">
              ИИ использует фото только для видимых деталей. Фото не сохраняется на сервере.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={locked}
                onClick={() => inputRef.current?.click()}
                className="rounded-full border border-olive-900/15 px-3.5 py-1.5 text-sm font-medium text-olive-900 transition hover:bg-olive-600/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 disabled:opacity-50"
              >
                Заменить
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onRemove}
                className="rounded-full border border-olive-900/15 px-3.5 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-600/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 disabled:opacity-50"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={locked}
          onClick={() => inputRef.current?.click()}
          {...dropHandlers}
          className={`group flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition disabled:cursor-not-allowed disabled:opacity-60 sm:py-12 ${
            dragOver ? "border-olive-600 bg-olive-600/10" : "border-olive-900/20 bg-cream-50/70 hover:border-olive-600/50 hover:bg-olive-600/[0.05]"
          }`}
        >
          <span
            aria-hidden
            className={`mb-1 flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              dragOver ? "bg-olive-600 text-cream-100" : "bg-olive-600/10 text-olive-600 group-hover:bg-olive-600 group-hover:text-cream-100"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z M4 15l4.5-4.5 4 4 2.5-2.5L20 17 M15.5 9.5h.01" />
            </svg>
          </span>
          <span className="text-sm font-medium text-olive-900">
            {processing ? "Обрабатываем фото…" : dragOver ? "Отпустите, чтобы добавить фото" : "Перетащите фото сюда или выберите файл"}
          </span>
          <span className="text-xs text-olive-600">
            Поможет точнее описать цвет, вид и детали товара
            <span className="hidden pointer-fine:inline"> · можно вставить из буфера (Ctrl+V)</span>
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
