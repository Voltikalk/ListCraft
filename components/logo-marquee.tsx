"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Скорость автопрокрутки, px/с. */
const SPEED = 36;
/** Копий ленты хватает, чтобы закрыть широкий экран без пустого места. */
const COPIES = 4;

/* Словесные знаки набраны текстом в фирменных цветах площадок — это не официальные файлы логотипов.
   Если появятся официальные SVG, достаточно заменить содержимое LOGOS. */
const LOGOS: { name: string; mark: ReactNode }[] = [
  {
    name: "Авито",
    mark: (
      <span className="flex items-center gap-2">
        <span aria-hidden className="relative h-6 w-6">
          <span className="absolute top-0 left-0 h-3.5 w-3.5 rounded-full bg-[#00aaff]" />
          <span className="absolute top-0.5 right-0 h-2.5 w-2.5 rounded-full bg-[#965eeb]" />
          <span className="absolute bottom-0 left-0.5 h-2.5 w-2.5 rounded-full bg-[#04e061]" />
          <span className="absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full bg-[#ff4053]" />
        </span>
        <span className="text-[1.6rem] font-semibold tracking-tight text-[#2b2b2b]">Avito</span>
      </span>
    ),
  },
  { name: "Ozon", mark: <span className="text-[1.75rem] font-black tracking-tight text-[#005bff] italic">OZON</span> },
  { name: "Wildberries", mark: <span className="text-[1.6rem] font-bold tracking-tight text-[#cb11ab]">wildberries</span> },
  {
    name: "eBay",
    mark: (
      <span className="text-[1.75rem] font-bold tracking-[-0.06em]">
        <span className="text-[#e53238]">e</span>
        <span className="text-[#0064d2]">b</span>
        <span className="text-[#f5af02]">a</span>
        <span className="text-[#86b817]">y</span>
      </span>
    ),
  },
  { name: "Etsy", mark: <span className="font-serif text-[1.75rem] text-[#f1641e]">Etsy</span> },
  {
    name: "Amazon",
    mark: (
      <span className="relative pb-1.5 text-[1.6rem] font-bold tracking-tight text-[#232f3e]">
        amazon
        <svg aria-hidden viewBox="0 0 60 10" className="absolute bottom-0 left-1 h-2 w-[78%]" fill="none">
          <path d="M2 2c16 7 36 7 52 0" stroke="#ff9900" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M50 0.8 55 2l-2.4 4.4" stroke="#ff9900" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    ),
  },
];

function Sequence({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} aria-label={hidden ? undefined : "Площадки"} className="flex shrink-0 items-center">
      {LOGOS.map((logo) => (
        <li key={logo.name} className="flex h-12 shrink-0 items-center px-7 opacity-85 transition-opacity hover:opacity-100 sm:px-10">
          {hidden ? logo.mark : <>{logo.mark}<span className="sr-only">{logo.name}</span></>}
        </li>
      ))}
    </ul>
  );
}

/** Лента логотипов площадок: едет сама, её можно тянуть мышью или пальцем, при наведении замирает. */
export function LogoMarquee() {
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!box || !track || !first) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = first.offsetWidth;
    let x = 0;
    let last = performance.now();
    let hover = false;
    let visible = true;
    let drag: { id: number; startX: number; startOffset: number } | null = null;
    let frame = 0;

    // Держим сдвиг в пределах одной копии ленты — так она бесконечна в обе стороны.
    const wrap = (value: number) => (width > 0 ? ((value % width) - width) % width : 0);
    const paint = () => {
      track.style.transform = `translate3d(${x}px, 0, 0)`;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!drag && !hover && visible && !reduceMotion.matches) {
        x = wrap(x - SPEED * dt);
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const resize = new ResizeObserver(() => {
      width = first.offsetWidth;
      x = wrap(x);
      paint();
    });
    resize.observe(first);

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    seen.observe(box);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { id: e.pointerId, startX: e.clientX, startOffset: x };
      box.dataset.dragging = "true";
      try {
        box.setPointerCapture(e.pointerId); // чтобы тянуть и за пределами ленты
      } catch {
        // указатель уже отпущен — тянем без захвата
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      x = wrap(drag.startOffset + e.clientX - drag.startX);
      paint();
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      delete box.dataset.dragging;
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hover = true;
    };
    const onLeave = () => {
      hover = false;
    };

    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp);
    box.addEventListener("pointercancel", onUp);
    box.addEventListener("pointerenter", onEnter);
    box.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp);
      box.removeEventListener("pointercancel", onUp);
      box.removeEventListener("pointerenter", onEnter);
      box.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className="cursor-grab touch-pan-y overflow-hidden select-none data-dragging:cursor-grabbing [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]"
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
        {Array.from({ length: COPIES }, (_, i) => (
          <Sequence key={i} hidden={i > 0} />
        ))}
      </div>
    </div>
  );
}
