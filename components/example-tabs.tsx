"use client";

import { useState, type ReactNode } from "react";

type Tab = { key: string; label: string; panel: ReactNode };

/** Переключатель примеров «на русском / на английском» на лендинге. */
export function ExampleTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      <div role="group" aria-label="Язык примера" className="inline-flex rounded-full border border-olive-900/15 bg-cream-50/70 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={active === tab.key}
            onClick={() => setActive(tab.key)}
            className="rounded-full px-4 py-2 text-sm font-medium text-olive-700 transition hover:text-olive-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 aria-pressed:bg-olive-600 aria-pressed:text-cream-100"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} hidden={active !== tab.key} className="mt-4">
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
