import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forms";
import { FormSkeleton, Notice } from "@/components/auth/notice";
import { primaryButton } from "@/components/site-chrome";
import { hasRecentEmailProof } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Новый пароль", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Новый пароль" description="Придумайте новый пароль. После сохранения на других устройствах нужно будет войти заново.">
      <AuthCard>
        <Suspense fallback={<FormSkeleton />}>
          <ResetContent />
        </Suspense>
      </AuthCard>
    </AuthShell>
  );
}

async function ResetContent() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/forgot-password?error=link");

  // Без старого пароля новый можно задать только сразу после перехода по ссылке из письма.
  if (!hasRecentEmailProof(claims.amr)) {
    return (
      <>
        <Notice tone="error">Ссылка для сброса пароля устарела. Запросите новую или смените пароль в аккаунте.</Notice>
        <Link href="/forgot-password" className={`${primaryButton} w-full`}>
          Запросить новую ссылку
        </Link>
      </>
    );
  }
  return <ResetPasswordForm />;
}
