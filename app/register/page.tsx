import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/forms";
import { OrDivider, YandexButton } from "@/components/auth/yandex-button";
import { isYandexConfigured } from "@/lib/server/yandex";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <AuthShell title="Регистрация" description="После регистрации пришлём письмо — подтвердите в нём адрес почты.">
      <AuthCard>
        {isYandexConfigured() && (
          <>
            <YandexButton />
            <OrDivider />
          </>
        )}
        <SignUpForm />
      </AuthCard>
      <p className="mt-5 text-center text-sm text-olive-700">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-olive-700 underline underline-offset-2 hover:text-olive-950">
          Войти
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-olive-600">
        Храним только почту и данные для входа.{" "}
        <Link href="/#privacy" className="underline underline-offset-2 hover:text-olive-900">
          Как мы обрабатываем данные
        </Link>
      </p>
    </AuthShell>
  );
}
