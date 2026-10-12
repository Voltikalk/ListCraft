"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Виджет Cloudflare Turnstile («Я не робот»). Обычно проходит незаметно; задачу показывает,
 * только если Cloudflare сомневается. Токен одноразовый — после каждого запроса меняйте resetKey.
 * Документация: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptPromise = null;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({
  siteKey,
  resetKey,
  onToken,
}: {
  siteKey: string;
  /** Изменение значения сбрасывает виджет и запрашивает новый токен. */
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current =
          window.turnstile.render(container.current, {
            sitekey: siteKey,
            appearance: "interaction-only",
            size: "flexible",
            theme: "light",
            language: "ru",
            // Токен добавляем в запрос сами, скрытое поле формы не нужно.
            "response-field": false,
            callback: (token: string) => {
              setFailed(false);
              onTokenRef.current(token);
            },
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => {
              setFailed(true);
              onTokenRef.current(null);
            },
          }) ?? null;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  return (
    <div className="mt-4">
      <div ref={container} />
      {failed && (
        <p role="alert" className="mt-2 text-sm text-rose-900">
          Не удалось пройти проверку «Я не робот». Обновите страницу; если не помогает — отключите блокировщик рекламы
          для этого сайта.
        </p>
      )}
    </div>
  );
}
