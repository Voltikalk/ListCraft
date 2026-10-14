"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import StarBorder from "@/components/reactbits/StarBorder";

/** Главная кнопка на оливковом фоне: кремовая «таблетка» с бегущим по контуру огоньком. */
export function StarCta({ href, className = "", children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <StarBorder
      as={Link}
      href={href}
      theme="light"
      backgroundColor="var(--color-cream-100)"
      textColor="var(--color-olive-800)"
      borderColor="rgba(96, 108, 56, 0.25)"
      color="#bc6c25"
      trailColor="#dda15e"
      radius={999}
      thickness={1.5}
      duration={5}
      trailLength={0.35}
      glow={0.7}
      className={`group px-6 py-3! text-base font-semibold transition active:scale-[0.98] focus-visible:outline-cream-100 ${className}`}
    >
      {children}
    </StarBorder>
  );
}
