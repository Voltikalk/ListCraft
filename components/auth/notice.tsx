import type { ReactNode } from "react";

/** Сообщение над формой: ошибка из адреса, «вы вышли», «пароль изменён». */
export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return tone === "error" ? (
    <p role="alert" className="mb-4 rounded-2xl border border-rose-600/25 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {children}
    </p>
  ) : (
    <p role="status" className="mb-4 rounded-2xl border border-olive-600/30 bg-olive-600/10 px-4 py-3 text-sm text-olive-900">
      {children}
    </p>
  );
}

/** Заглушка на время загрузки формы — той же высоты, чтобы страница не прыгала. */
export function FormSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 w-24 rounded bg-olive-900/10" />
          <div className="h-11 rounded-xl bg-olive-900/[0.06]" />
        </div>
      ))}
      <div className="h-12 rounded-full bg-olive-600/20" />
    </div>
  );
}
