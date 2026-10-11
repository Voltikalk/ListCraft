type Props = {
  onShowDemo: () => void;
};

/** Показывается, когда на сервере не задан GROQ_API_KEY. */
export function SetupNotice({ onShowDemo }: Props) {
  // Инструкции по настройке нужны только разработчику — посетитель сайта их не видит.
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div role="alert" className="rounded-2xl border border-olive-600/25 bg-olive-600/[0.07] p-5 text-sm text-olive-800">
      {isProduction ? (
        <>
          <p className="text-base font-semibold text-olive-950">Генерация через ИИ временно недоступна</p>
          <p className="mt-1 text-olive-700">Попробуйте позже. Пока можно посмотреть, как выглядит результат, на примере.</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-olive-950">Генерация через ИИ ещё не настроена</p>
          <p className="mt-1 text-olive-700">На сервере не задан ключ GROQ_API_KEY. Чтобы включить генерацию:</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>
              Создайте API-ключ в{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-olive-600 underline underline-offset-2"
              >
                GroqCloud Console
              </a>
              .
            </li>
            <li>
              Скопируйте файл <code className="rounded bg-olive-600/10 px-1 py-0.5 text-xs text-olive-900">.env.example</code> в{" "}
              <code className="rounded bg-olive-600/10 px-1 py-0.5 text-xs text-olive-900">.env.local</code> и укажите ключ в{" "}
              <code className="rounded bg-olive-600/10 px-1 py-0.5 text-xs text-olive-900">GROQ_API_KEY</code>.
            </li>
            <li>
              Перезапустите сервер: <code className="rounded bg-olive-600/10 px-1 py-0.5 text-xs text-olive-900">npm run dev</code>.
            </li>
          </ol>
          <p className="mt-3 text-xs text-olive-600">Ключ хранится только на сервере и никогда не передаётся в браузер.</p>
        </>
      )}
      <button
        type="button"
        onClick={onShowDemo}
        className="mt-4 rounded-full border border-ochre-500/50 bg-ochre-100 px-4 py-2 text-sm font-medium text-ochre-800 transition hover:bg-ochre-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ochre-500"
      >
        Показать демо-пример (не ИИ)
      </button>
    </div>
  );
}
