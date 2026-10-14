import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut, signOutEverywhere } from "@/app/auth/actions";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/forms";
import { FormSkeleton, Notice } from "@/components/auth/notice";
import { focusRing, secondaryButton } from "@/components/site-chrome";
import { firstParam, type SearchParams } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Аккаунт", robots: { index: false, follow: false } };

export default function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthShell title="Аккаунт" wide>
      <Suspense
        fallback={
          <AuthCard>
            <FormSkeleton rows={3} />
          </AuthCard>
        }
      >
        <AccountContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

const DATE = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Europe/Moscow" });
const DATE_TIME = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Moscow" });

function formatDate(value: string | undefined, format: Intl.DateTimeFormat): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format.format(date);
}

async function AccountContent({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  if (!supabase) return null;
  // getUser() проверяет сессию на сервере Supabase, а не только подпись токена.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=/account");
  const user = data.user;
  const passwordUpdated = firstParam((await searchParams).password) === "updated";

  return (
    <div className="space-y-5">
      {passwordUpdated && <Notice tone="success">Пароль изменён. На других устройствах нужно будет войти заново.</Notice>}

      <AuthCard>
        <h2 className="text-base font-semibold text-olive-950">Данные аккаунта</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-olive-600">Почта</dt>
            <dd className="mt-0.5 truncate font-medium text-olive-950" title={user.email}>
              {user.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-olive-600">Аккаунт создан</dt>
            <dd className="mt-0.5 font-medium text-olive-950">{formatDate(user.created_at, DATE)}</dd>
          </div>
          <div>
            <dt className="text-xs text-olive-600">Последний вход (МСК)</dt>
            <dd className="mt-0.5 font-medium text-olive-950">{formatDate(user.last_sign_in_at, DATE_TIME)}</dd>
          </div>
        </dl>
        <p className="mt-5 border-t border-olive-900/10 pt-4 text-xs leading-relaxed text-olive-600">
          Аккаунт пока ничего не меняет в генераторе: бесплатный лимит считается так же, как без входа.
        </p>
      </AuthCard>

      <AuthCard>
        <h2 className="text-base font-semibold text-olive-950">Смена пароля</h2>
        <p className="mt-1 mb-4 text-sm text-olive-700">
          Входили через Яндекс ID и не задавали пароль?{" "}
          <Link href="/forgot-password" className={`rounded font-medium underline underline-offset-2 hover:text-olive-950 ${focusRing}`}>
            Задайте его по ссылке из письма
          </Link>
          .
        </p>
        <ChangePasswordForm />
      </AuthCard>

      <AuthCard>
        <h2 className="text-base font-semibold text-olive-950">Выход</h2>
        <p className="mt-1 text-sm text-olive-700">
          Выход на всех устройствах завершит все сессии — например, если вы входили с чужого компьютера.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={signOut}>
            <button type="submit" className={secondaryButton}>
              Выйти
            </button>
          </form>
          <form action={signOutEverywhere}>
            <button type="submit" className={`${secondaryButton} border-rose-600/30 text-rose-800 hover:border-rose-600 hover:bg-rose-600/10`}>
              Выйти на всех устройствах
            </button>
          </form>
        </div>
      </AuthCard>
    </div>
  );
}
