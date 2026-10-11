"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { prepareImage, validateImageFile, type PreparedImage } from "@/lib/client/prepare-image";
import { DEMO_LISTING, EXAMPLE_INPUT } from "@/lib/demo-listing";
import {
  listingInputSchema,
  listingOutputSchema,
  type GenerateErrorCode,
  type GenerateResponse,
  type ListingOutput,
} from "@/lib/listing-schema";
import { CONTACT_EMAIL, PAID_PACK } from "@/lib/site";
import { ListingResult } from "./listing-result";
import { PhotoUpload } from "./photo-upload";
import { EMPTY_FORM, ProductForm, type FormValues } from "./product-form";
import { SetupNotice } from "./setup-notice";
import { MailLink } from "./site-chrome";

/** Чуть больше, чем maxDuration маршрута, чтобы обычно получать ответ сервера, а не обрыв. */
const CLIENT_TIMEOUT_MS = 130_000;

type Result = { id: number; listing: ListingOutput; isDemo: boolean };
/** upsell — исчерпана личная бесплатная квота (а не часовой или общий лимит сервиса). */
type UiError = { code: GenerateErrorCode | "network" | "timeout"; message: string; upsell?: boolean };
type Photo = PreparedImage & { id: number };

function inputKey(values: FormValues, photo: Photo | null) {
  return JSON.stringify([values, photo?.id ?? null]);
}

export function ListingGenerator() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [confirmRepeat, setConfirmRepeat] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const inFlight = useRef(false);
  const counter = useRef(0);
  const photoToken = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  // Фото, брошенное мимо зоны загрузки, браузер открыл бы вместо страницы — и форма бы потерялась.
  useEffect(() => {
    const guard = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, []);

  // Освобождаем память превью при замене/удалении фото и при уходе со страницы.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  const currentKey = inputKey(values, photo);
  const unchanged = result !== null && !result.isDemo && lastKey === currentKey;

  const handleValues = (next: FormValues) => {
    setValues(next);
    setConfirmRepeat(false);
    if (Object.keys(fieldErrors).length) {
      // Убираем ошибку у поля, которое пользователь начал исправлять.
      const changed = (Object.keys(next) as (keyof FormValues)[]).filter((k) => next[k] !== values[k]);
      setFieldErrors((prev) => {
        const copy = { ...prev };
        for (const k of changed) delete copy[k];
        return copy;
      });
    }
  };

  const handlePhoto = async (file: File) => {
    if (loading) return;
    setPhotoError(null);
    setConfirmRepeat(false);
    const problem = validateImageFile(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    // Если пользователь успел выбрать другое фото или удалить это, результат обработки устарел.
    const token = ++photoToken.current;
    setPhotoProcessing(true);
    try {
      const prepared = await prepareImage(file);
      if (token !== photoToken.current) {
        URL.revokeObjectURL(prepared.previewUrl);
        return;
      }
      counter.current += 1;
      setPhoto({ ...prepared, id: counter.current });
    } catch (e) {
      if (token === photoToken.current) setPhotoError(e instanceof Error ? e.message : "Не удалось обработать фото.");
    } finally {
      if (token === photoToken.current) setPhotoProcessing(false);
    }
  };

  const fillExample = () => {
    const hasInput = Object.values(values).some((v) => v.trim() !== "");
    if (hasInput && !window.confirm("Заменить введённые данные примером?")) return;
    setValues({ ...EXAMPLE_INPUT });
    setFieldErrors({});
    setConfirmRepeat(false);
    if (error?.code === "validation_error") setError(null);
  };

  const removePhoto = () => {
    photoToken.current += 1;
    setPhotoProcessing(false);
    setPhoto(null);
    setPhotoError(null);
    setConfirmRepeat(false);
  };

  const submit = async () => {
    if (inFlight.current || photoProcessing) return;

    const parsed = listingInputSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
      setFieldErrors(errors);
      setError({ code: "validation_error", message: "Проверьте заполнение формы." });
      document.getElementById(Object.keys(errors)[0] ?? "productName")?.focus();
      return;
    }

    // Защита от случайной повторной траты попытки на те же данные.
    if (unchanged && !confirmRepeat) {
      setConfirmRepeat(true);
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setConfirmRepeat(false);
    const key = currentKey;

    const form = new FormData();
    for (const [name, value] of Object.entries(parsed.data)) form.append(name, value);
    if (photo) form.append("photo", photo.file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: form, signal: controller.signal });
      let data: GenerateResponse | null = null;
      try {
        data = (await res.json()) as GenerateResponse;
      } catch {
        data = null;
      }

      if (!data || typeof data !== "object" || !("ok" in data)) {
        setRemaining(null);
        setError({
          code: "internal_error",
          message: `Сервер вернул неожиданный ответ (код ${res.status}). Попробуйте ещё раз.`,
        });
        return;
      }

      if (!data.ok) {
        // Неудачная попытка могла быть засчитана — показываем остаток, который сообщил сервер.
        if (typeof data.remainingToday === "number") setRemaining(data.remainingToday);
        setError({
          code: data.error.code,
          message: data.error.message,
          upsell: data.error.code === "rate_limited" && data.remainingToday === 0,
        });
        if (data.error.fields) {
          const { photo: photoFieldError, ...rest } = data.error.fields;
          setFieldErrors(rest);
          if (photoFieldError) setPhotoError(photoFieldError);
        }
        return;
      }

      // Повторная проверка структуры на клиенте — на случай неожиданных изменений API.
      const listing = listingOutputSchema.safeParse(data.listing);
      if (!listing.success) {
        setError({ code: "ai_invalid_output", message: "Получен ответ в неожиданном формате. Попробуйте ещё раз." });
        return;
      }

      counter.current += 1;
      setResult({ id: counter.current, listing: listing.data, isDemo: false });
      setLastKey(key);
      setRemaining(typeof data.remainingToday === "number" ? data.remainingToday : null);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setRemaining(null); // сервер мог засчитать попытку, точный остаток неизвестен
      if (e instanceof DOMException && e.name === "AbortError") {
        setError({ code: "timeout", message: "Сервер слишком долго не отвечает. Проверьте соединение и попробуйте ещё раз." });
      } else {
        setError({ code: "network", message: "Не удалось связаться с сервером. Проверьте подключение к интернету." });
      }
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setLoading(false);
    }
  };

  const showDemo = () => {
    counter.current += 1;
    setResult({ id: counter.current, listing: DEMO_LISTING, isDemo: true });
    setError(null);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const busy = loading || photoProcessing;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* Форма */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Данные о товаре</h2>
          <button
            type="button"
            onClick={fillExample}
            disabled={loading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Заполнить примером
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Пишите по-русски и указывайте то, что знаете точно: ИИ получает инструкцию не додумывать недостающее.
        </p>

        <div className="mt-5">
          <ProductForm
            values={values}
            errors={fieldErrors}
            disabled={loading}
            onChange={handleValues}
            photoSlot={
              <PhotoUpload
                previewUrl={photo?.previewUrl ?? null}
                processing={photoProcessing}
                disabled={loading}
                error={photoError}
                onSelect={handlePhoto}
                onRemove={removePhoto}
              />
            }
          />
        </div>

        {confirmRepeat && (
          <div role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Данные не изменились с прошлого раза. Новый вариант засчитается как ещё одно объявление из бесплатного
            лимита. Нажмите кнопку ещё раз, чтобы продолжить.
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          aria-busy={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {loading ? (
            <>
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Создаём объявление…
            </>
          ) : confirmRepeat ? (
            "Да, создать новый вариант"
          ) : unchanged ? (
            "Создать другой вариант"
          ) : (
            "Создать объявление"
          )}
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          {remaining !== null
            ? `Осталось бесплатных объявлений: ${remaining}`
            : "Создание объявления может занять до полутора минут"}
        </p>
      </form>

      {/* Результат */}
      <div ref={resultRef} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Объявление на английском</h2>

        {/* Короткие сообщения для экранного диктора; ошибки озвучиваются через role="alert". */}
        <p role="status" className="sr-only">
          {loading ? "Создаём объявление…" : result && !error ? (result.isDemo ? "Показан демо-пример" : "Объявление готово") : ""}
        </p>

        <div className="mt-4 space-y-4">
          {error &&
            (error.code === "missing_api_key" ? (
              <SetupNotice onShowDemo={showDemo} />
            ) : (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-semibold">Не получилось создать объявление</p>
                <p className="mt-1">{error.message}</p>
                {error.upsell && (
                  <p className="mt-2">
                    Нужно больше объявлений?{" "}
                    {/* В новой вкладке, чтобы не потерять текущий результат. */}
                    <Link href="/#pricing" target="_blank" rel="noopener" className="font-medium underline underline-offset-2">
                      Пакет {PAID_PACK.generations} объявлений за {PAID_PACK.price}
                    </Link>{" "}
                    — оплата пока не подключена{CONTACT_EMAIL ? ", но можно оставить заявку" : ""}.
                  </p>
                )}
                {CONTACT_EMAIL && (error.code === "internal_error" || error.code === "ai_invalid_output" || error.code === "ai_error") && (
                  <p className="mt-2">
                    Если ошибка повторяется, <MailLink topic="bug">сообщите нам</MailLink>.
                  </p>
                )}
              </div>
            ))}

          {loading && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">ИИ переводит и оформляет объявление…</p>
              {[1, 3, 2, 2].map((lines, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
                  {Array.from({ length: lines }).map((_, j) => (
                    <div key={j} className="h-9 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Во время загрузки результат скрыт, но не размонтирован: если новая генерация
              не удастся, правки пользователя в прошлом варианте сохранятся. */}
          {result ? (
            <div hidden={loading}>
              <ListingResult key={result.id} listing={result.listing} isDemo={result.isDemo} />
              {!result.isDemo && CONTACT_EMAIL && (
                <p className="mt-4 text-sm text-slate-500">
                  <MailLink topic="feedback">Оставьте отзыв о результате</MailLink>
                  {" — "}это поможет сделать сервис лучше.
                </p>
              )}
            </div>
          ) : (
            !error &&
            !loading && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center">
                <svg aria-hidden viewBox="0 0 24 24" className="h-9 w-9 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 3.5h7.5L19 8v12.5H7z M14.5 3.5V8H19 M10 12h6 M10 15.5h6" />
                </svg>
                <p className="mt-3 text-sm font-medium text-slate-700">Здесь появится готовое объявление</p>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Заголовок, описание, характеристики и ключевые слова — каждое поле можно отредактировать и скопировать.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
