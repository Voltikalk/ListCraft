import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { Notice } from "@/components/auth/notice";
import { firstParam, type SearchParams } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Восстановление пароля", robots: { index: false } };

export default function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthShell
      title="Восстановление пароля"
      description="Укажите почту аккаунта — пришлём ссылку, по которой можно задать новый пароль."
    >
      <AuthCard>
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} />
        </Suspense>
        <ForgotPasswordForm />
      </AuthCard>
      <p className="mt-5 text-center text-sm text-olive-700">
        Вспомнили пароль?{" "}
        <Link href="/login" className="font-medium text-olive-700 underline underline-offset-2 hover:text-olive-950">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}

async function LinkError({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (firstParam(params.error) !== "link") return null;
  return <Notice tone="error">Ссылка для сброса пароля недействительна или устарела. Запросите новую.</Notice>;
}
