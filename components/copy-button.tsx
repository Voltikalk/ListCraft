"use client";

import { useEffect, useState } from "react";

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Запасной вариант для браузеров без Clipboard API (например, http не на localhost).
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }
}

type Props = {
  text: string;
  label?: string;
  variant?: "ghost" | "primary";
};

export function CopyButton({ text, label = "Копировать", variant = "ghost" }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const base =
    "inline-flex items-center gap-1.5 rounded-full text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-olive-600 px-3.5 py-2 text-cream-100 hover:bg-olive-700"
      : "border border-olive-900/15 bg-cream-50/70 px-2.5 py-1.5 text-olive-800 hover:bg-olive-600/10 hover:text-olive-950";

  return (
    <button
      type="button"
      className={`${base} ${styles}`}
      disabled={!text.trim()}
      onClick={async () => setState((await writeToClipboard(text)) ? "copied" : "failed")}
      aria-live="polite"
    >
      {state === "copied" ? (
        <>
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-olive-600" fill="currentColor">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
          </svg>
          Скопировано
        </>
      ) : state === "failed" ? (
        "Не удалось скопировать"
      ) : (
        <>
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="6.5" y="6.5" width="10" height="10" rx="2" />
            <path d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
