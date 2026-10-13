/*
 * TextType — из React Bits (https://reactbits.dev, github.com/DavidHDev/react-bits).
 * Copyright (c) 2026 David Haz. Лицензия MIT + Commons Clause — см. THIRD_PARTY_NOTICES.md.
 * Упрощено: без gsap (курсор мигает на CSS), место под полный текст резервируется заранее,
 * чтобы блок не прыгал по высоте; при «уменьшить движение» текст показывается сразу.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

interface TextTypeProps {
  text: string | string[];
  className?: string;
  cursorClassName?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  loop?: boolean;
  variableSpeed?: { min: number; max: number };
  startOnVisible?: boolean;
}

const TextType = ({
  text,
  className = '',
  cursorClassName = '',
  typingSpeed = 50,
  deletingSpeed = 30,
  initialDelay = 0,
  pauseDuration = 2000,
  loop = true,
  variableSpeed,
  startOnVisible = false
}: TextTypeProps) => {
  const texts = Array.isArray(text) ? text : [text];
  const textsKey = texts.join('\u0000');
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [visible, setVisible] = useState(!startOnVisible);
  const [instant, setInstant] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setInstant(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!startOnVisible || !rootRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) setVisible(true);
      },
      { threshold: 0.1 }
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!visible || instant) return;
    const list = textsKey.split('\u0000');
    const current = list[index % list.length];
    const last = index % list.length === list.length - 1;
    const speed = variableSpeed
      ? Math.random() * (variableSpeed.max - variableSpeed.min) + variableSpeed.min
      : typingSpeed;

    let delay: number;
    let step: () => void;
    if (deleting) {
      if (shown === '') {
        delay = 0;
        step = () => {
          setDeleting(false);
          setIndex(i => (i + 1) % list.length);
        };
      } else {
        delay = deletingSpeed;
        step = () => setShown(s => s.slice(0, -1));
      }
    } else if (shown.length < current.length) {
      delay = shown === '' && index === 0 ? initialDelay : speed;
      step = () => setShown(current.slice(0, shown.length + 1));
    } else {
      if (!loop && last) return;
      if (list.length === 1 && !loop) return;
      delay = pauseDuration;
      step = () => setDeleting(true);
    }
    const timer = setTimeout(step, delay);
    return () => clearTimeout(timer);
  }, [visible, instant, textsKey, index, shown, deleting, typingSpeed, deletingSpeed, initialDelay, pauseDuration, loop, variableSpeed]);

  const full = texts[index % texts.length];
  const output = instant ? full : shown;

  return (
    <span ref={rootRef} className={`relative inline-grid ${className}`}>
      {/* Невидимая копия держит высоту под полный текст. */}
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre-wrap">
        {full}
        <span className="ml-0.5 inline-block w-px" />
      </span>
      <span className="col-start-1 row-start-1 whitespace-pre-wrap">
        {output}
        <span
          aria-hidden
          className={`ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.2em] bg-current motion-safe:animate-[text-type-blink_1s_linear_infinite] ${cursorClassName}`}
        />
      </span>
    </span>
  );
};

export default TextType;
