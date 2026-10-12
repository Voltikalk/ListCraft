"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { prepareImage, validateImageFile, type PreparedImage } from "@/lib/client/prepare-image";
import { DEMO_LISTINGS, EXAMPLE_INPUT } from "@/lib/demo-listing";
import {
  listingInputSchema,
  listingOutputSchema,
  MARKETS,
  type GenerateErrorCode,
  type GenerateResponse,
  type ListingOutput,
  type Market,
} from "@/lib/listing-schema";
import { CONTACT_EMAIL, PAID_PACK, TURNSTILE_SITE_KEY } from "@/lib/site";
import { ListingResult } from "./listing-result";
import { PhotoUpload } from "./photo-upload";
import { EMPTY_FORM, ProductForm, type FormValues } from "./product-form";
import { SetupNotice } from "./setup-notice";
import { card, MailLink, primaryButton } from "./site-chrome";
import { Turnstile } from "./turnstile";

/** Чуть больше, чем maxDuration маршрута, чтобы обычно получать ответ сервера, а не обрыв. */
const CLIENT_TIMEOUT_MS = 130_000;

type Result = { id: number; listing: ListingOutput; isDemo: boolean; market: Market };
/** upsell — исчерпана личная бесплатная квота (а не часовой или общий лимит сервиса). */
type UiError = { code: GenerateErrorCode | "network" | "timeout" | "captcha_pending"; message: string; upsell?: boolean };
type Photo = PreparedImage & { id: number };

function inputKey(values: FormValues, photo: Photo | null) {
  return JSON.stringify([values, photo?.id ?? null]);
}

/** Ожидание без выдуманных процентов: сколько прошло и что происходит. */
function GenerationProgress({ market, withPhoto }: { market: Market; withPhoto: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const hint =
    seconds < 30
      ? "Не закрывайте страницу — объявление появится здесь."
      : seconds < 90
        ? `${withPhoto ? "С фотографией" : "Иногда"} ответ занимает дольше. Ждём до двух минут.`
        : "Ответ задерживается. Если сервер не ответит, здесь появится сообщение об ошибке.";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-medium text-olive-900">
          {market === "ru" ? "ИИ оформляет объявление на русском…" : "ИИ переводит и оформляет объявление…"}
        </p>
        <span aria-hidden className="shrink-0 tabular-nums text-olive-600">
          {seconds} с
        </span>
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-olive-600/10">
        <div className="h-full w-2/5 rounded-full bg-olive-600 motion-safe:animate-progress motion-reduce:w-full motion-reduce:opacity-40" />
      </div>
      <p className="text-xs text-olive-600">{hint}</p>
    </div>
  );
}

/** На узком экране карточка результата под формой — показываем её, чтобы было видно ожидание и ошибки. */
function revealOnNarrowScreen(element: HTMLElement | null) {
  if (element && !window.matchMedia("(min-width: 1024px)").matches) {
    requestAnimationFrame(() => element.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

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
    const { market, ...fields } = values;
    const hasInput = Object.values(fields).some((v) => v.trim() !== "");
    if (hasInput && !window.confirm("Заменить введённые данные примером?")) return;
    setValues({ ...EXAMPLE_INPUT, market });
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

    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError({
        code: "captcha_pending",
        message: "Проверка «Я не робот» ещё не завершена. Подождите пару секунд и нажмите кнопку снова.",
      });
      revealOnNarrowScreen(resultRef.current);
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
    if (captchaToken) form.append("cf-turnstile-response", captchaToken);
    revealOnNarrowScreen(resultRef.current);

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
      setResult({ id: counter.current, listing: listing.data, isDemo: false, market: parsed.data.market });
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
      // Токен Turnstile одноразовый — для следующего запроса нужен новый.
      if (TURNSTILE_SITE_KEY) {
        setCaptchaToken(null);
        setCaptchaReset((n) => n + 1);
      }
    }
  };

  const showDemo = () => {
    counter.current += 1;
    setResult({ id: counter.current, listing: DEMO_LISTINGS[values.market], isDemo: true, market: values.market });
    setError(null);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const busy = loading || photoProcessing;
  // Пока результата нет, заголовок панели следует за выбором в форме.
  const shownKey: Market = result && !loading ? result.market : values.market;
  const shownMarket = MARKETS[shownKey];

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* Форма */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className={`${card} p-5 sm:p-7`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-olive-950">Данные о товаре</h2>
          <button
            type="button"
            onClick={fillExample}
            disabled={loading}
            className="rounded-full border border-olive-600/30 bg-olive-600/10 px-3.5 py-1.5 text-sm font-medium text-olive-600 transition hover:bg-olive-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Заполнить примером
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-olive-700">
          Пишите по-русски, можно коротко и с ошибками. Указывайте то, что знаете точно: ИИ получает инструкцию не
          додумывать недостающее.
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
          <div role="status" className="mt-5 rounded-2xl border border-ochre-500/40 bg-ochre-100 p-3 text-sm text-ochre-800">
            Данные не изменились с прошлого раза. Новый вариант засчитается как ещё одно объявление из бесплатного
            лимита. Нажмите кнопку ещё раз, чтобы продолжить.
          </div>
        )}

        {TURNSTILE_SITE_KEY && (
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            resetKey={captchaReset}
            onToken={(token) => {
              setCaptchaToken(token);
              if (token) setError((prev) => (prev?.code === "captcha_pending" ? null : prev));
            }}
          />
        )}

        <button
          type="submit"
          disabled={busy}
          aria-busy={loading}
          className={`${primaryButton} mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? (
            <>
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-cream-100/40 border-t-cream-100" />
              Создаём объявление…
            </>
          ) : confirmRepeat ? (
            "Да, создать новый вариант"
          ) : unchanged ? (
            "Создать другой вариант"
          ) : (
            `Создать объявление ${MARKETS[values.market].languageLabel}`
          )}
        </button>
        <p className="mt-2 text-center text-xs text-olive-600">
          {remaining !== null
            ? `Осталось бесплатных объявлений: ${remaining}`
            : "Создание объявления может занять до полутора минут"}
        </p>
      </form>

      {/* Результат */}
      <div ref={resultRef} className={`${card} scroll-mt-24 p-5 sm:p-7`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-olive-950">Объявление {shownMarket.languageLabel}</h2>
          <span className="text-xs font-medium text-olive-600">{shownMarket.platforms}</span>
        </div>

        {/* Короткие сообщения для экранного диктора; ошибки озвучиваются через role="alert". */}
        <p role="status" className="sr-only">
          {loading ? "Создаём объявление…" : result && !error ? (result.isDemo ? "Показан демо-пример" : "Объявление готово") : ""}
        </p>

        <div className="mt-4 space-y-4">
          {error &&
            (error.code === "missing_api_key" ? (
              <SetupNotice onShowDemo={showDemo} />
            ) : (
              <div role="alert" className="rounded-2xl border border-rose-600/25 bg-rose-600/[0.07] p-4 text-sm text-rose-900">
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
              <GenerationProgress market={shownKey} withPhoto={photo !== null} />
              {[1, 3, 2, 2].map((lines, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-olive-600/10" />
                  {Array.from({ length: lines }).map((_, j) => (
                    <div key={j} className="h-9 animate-pulse rounded-xl bg-olive-600/10" />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Во время загрузки результат скрыт, но не размонтирован: если новая генерация
              не удастся, правки пользователя в прошлом варианте сохранятся. */}
          {result ? (
            <div hidden={loading} className="motion-safe:animate-rise">
              <ListingResult key={result.id} listing={result.listing} isDemo={result.isDemo} market={result.market} />
              {!result.isDemo && CONTACT_EMAIL && (
                <p className="mt-4 text-sm text-olive-600">
                  <MailLink topic="feedback">Оставьте отзыв о результате</MailLink>
                  {" — "}это поможет сделать сервис лучше.
                </p>
              )}
            </div>
          ) : (
            !error &&
            !loading && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-olive-900/20 bg-cream-50/70 px-6 py-16 text-center">
                <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-olive-600 text-cream-100">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 3.5h7.5L19 8v12.5H7z M14.5 3.5V8H19 M10 12h6 M10 15.5h6" />
                  </svg>
                </span>
                <p className="mt-4 text-sm font-medium text-olive-900">Здесь появится готовое объявление</p>
                <p className="mt-1 max-w-xs text-sm text-olive-600">
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
