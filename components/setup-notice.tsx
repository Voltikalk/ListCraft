type Props = {
  onShowDemo: () => void;
};

/** Показывается, когда на сервере не задан ANTHROPIC_API_KEY. */
export function SetupNotice({ onShowDemo }: Props) {
  // Инструкции по настройке нужны только разработчику — посетитель сайта их не видит.
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div role="alert" className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-slate-800">
      {isProduction ? (
        <>
          <p className="text-base font-semibold text-slate-900">Генерация через ИИ временно недоступна</p>
          <p className="mt-1 text-slate-600">Попробуйте позже. Пока можно посмотреть, как выглядит результат, на примере.</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-900">Генерация через ИИ ещё не настроена</p>
          <p className="mt-1 text-slate-600">На сервере не задан ключ ANTHROPIC_API_KEY. Чтобы включить генерацию:</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>
              Создайте API-ключ в{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-indigo-700 underline underline-offset-2"
              >
                Anthropic Console
              </a>{" "}
              и пополните баланс.
            </li>
            <li>
              Скопируйте файл <code className="rounded bg-white px-1 py-0.5 text-xs">.env.example</code> в{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs">.env.local</code> и укажите ключ в{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>.
            </li>
            <li>
              Перезапустите сервер: <code className="rounded bg-white px-1 py-0.5 text-xs">npm run dev</code>.
            </li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">Ключ хранится только на сервере и никогда не передаётся в браузер.</p>
        </>
      )}
      <button
        type="button"
        onClick={onShowDemo}
        className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
      >
        Показать демо-пример (не ИИ)
      </button>
    </div>
  );
}
