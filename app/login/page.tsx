import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/forms";
import { FormSkeleton, Notice } from "@/components/auth/notice";
import { OrDivider, YandexButton } from "@/components/auth/yandex-button";
import { errorMessage, firstParam, type SearchParams } from "@/lib/auth/messages";
import { safeNext } from "@/lib/auth/validation";
import { isYandexConfigured } from "@/lib/server/yandex";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthShell title="Вход" description="Войдите, чтобы открыть свой аккаунт. Генератор работает и без входа.">
      <AuthCard>
        <Suspense fallback={<FormSkeleton />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </AuthCard>
      <p className="mt-5 text-center text-sm text-olive-700">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-olive-700 underline underline-offset-2 hover:text-olive-950">
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  );
}

async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = errorMessage(firstParam(params.error));
  const next = safeNext(firstParam(params.next));
  const signedOutEverywhere = firstParam(params.signed_out) === "all";

  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      {signedOutEverywhere && <Notice tone="success">Вы вышли из аккаунта на всех устройствах.</Notice>}
      {isYandexConfigured() && (
        <>
          <YandexButton next={next} />
          <OrDivider />
        </>
      )}
      <SignInForm next={next === "/account" ? undefined : next} />
    </>
  );
}
