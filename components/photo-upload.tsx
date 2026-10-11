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
        <span className="text-sm font-medium text-slate-800">Фото товара</span>
        <span className="text-xs text-slate-500">необязательно · JPEG, PNG, WebP до 5 МБ</span>
      </div>

      {previewUrl ? (
        <div
          {...dropHandlers}
          className={`flex items-center gap-4 rounded-xl border p-3 transition ${
            dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"
          }`}
        >
          <img
            src={previewUrl}
            alt="Превью загруженного фото"
            className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 sm:h-24 sm:w-24"
          />
          <div className="min-w-0 flex-1 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{processing ? "Обрабатываем новое фото…" : "Фото добавлено"}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              ИИ использует фото только для видимых деталей. Фото не сохраняется на сервере.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={locked}
                onClick={() => inputRef.current?.click()}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Заменить
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onRemove}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
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
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
            dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50"
          }`}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 16.5V18a2.5 2.5 0 0 0 2.5 2.5h13A2.5 2.5 0 0 0 21 18v-1.5M7.5 8 12 3.5 16.5 8M12 3.5V15" />
          </svg>
          <span className="text-sm font-medium text-slate-700">
            {processing ? "Обрабатываем фото…" : "Нажмите или перетащите фото"}
          </span>
          <span className="text-xs text-slate-500">Поможет точнее описать цвет, вид и детали товара</span>
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
        <p role="alert" className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
