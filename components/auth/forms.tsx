"use client";

import Link from "next/link";
import { useActionState, useId, useState, type ReactNode } from "react";
import { changePassword, requestPasswordReset, setNewPassword, signIn, signUp } from "@/app/auth/actions";
import { focusRing, primaryButton } from "@/components/site-chrome";
import { Turnstile } from "@/components/turnstile";
import { INITIAL_FORM_STATE, type AuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

/*
 * Формы аккаунта. Все проверки повторяются на сервере — атрибуты полей здесь только подсказка.
 * Пароли не попадают в состояние React: поля неуправляемые и очищаются после каждой отправки.
 */

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

const inputClass =
  "block w-full rounded-xl border bg-cream-50/70 px-3.5 py-2.5 text-sm text-olive-900 transition placeholder:text-olive-500/80 hover:border-olive-900/30 focus:bg-cream-50 focus:outline-none focus:ring-4 focus:ring-olive-600/15 disabled:cursor-not-allowed disabled:opacity-60";

function borderFor(error?: string) {
  return error ? "border-rose-600/60 focus:border-rose-600" : "border-olive-900/15 focus:border-olive-600/70";
}

const linkClass = `rounded font-medium text-olive-700 underline underline-offset-2 hover:text-olive-950 ${focusRing}`;

function Field({
  id,
  label,
  hint,
  error,
  aside,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-olive-900">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-olive-600">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

function EmailField({ state, disabled, autoFocus }: { state: AuthFormState; disabled: boolean; autoFocus?: boolean }) {
  const id = `${useId()}-email`;
  const error = state.fieldErrors?.email;
  return (
    <Field id={id} label="Почта" error={error}>
      <input
        id={id}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        // React очищает форму после отправки — адрес возвращается из ответа сервера.
        defaultValue={state.email}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder="name@example.ru"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error)}
        className={`${inputClass} ${borderFor(error)}`}
      />
    </Field>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  state,
  disabled,
  hint,
  aside,
  isNew = false,
}: {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  state: AuthFormState;
  disabled: boolean;
  hint?: string;
  aside?: ReactNode;
  isNew?: boolean;
}) {
  const id = `${useId()}-${name}`;
  const [visible, setVisible] = useState(false);
  const error = state.fieldErrors?.[name];
  return (
    <Field id={id} label={label} hint={hint} error={error} aside={aside}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={isNew ? PASSWORD_MIN_LENGTH : undefined}
          maxLength={256}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`${inputClass} ${borderFor(error)} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          aria-pressed={visible}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          className={`absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg text-olive-600 transition hover:bg-olive-600/10 hover:text-olive-900 ${focusRing}`}
        >
          <EyeIcon crossed={visible} />
        </button>
      </div>
    </Field>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}

function FormMessage({ state }: { state: AuthFormState }) {
  if (!state.message) return null;
  if (state.status === "success") {
    return (
      <p role="status" className="rounded-2xl border border-olive-600/30 bg-olive-600/10 px-4 py-3 text-sm text-olive-900">
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-2xl border border-rose-600/25 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {state.message}
    </p>
  );
}

/**
 * Обёртка формы: состояние действия, «Я не робот» и кнопка отправки.
 * Токен Turnstile одноразовый, поэтому после каждой отправки виджет сбрасывается.
 */
function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  captcha = true,
  children,
}: {
  action: Action;
  submitLabel: string;
  pendingLabel: string;
  captcha?: boolean;
  children: (state: AuthFormState, pending: boolean) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_FORM_STATE);
  const siteKey = captcha ? TURNSTILE_SITE_KEY : null;
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const waitingForCaptcha = Boolean(siteKey && !token);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // Данные формы уже собраны — следующий запрос получит новый токен.
        if (siteKey) {
          setToken(null);
          setResetKey((key) => key + 1);
        }
      }}
      className="space-y-4"
    >
      {children(state, pending)}
      {siteKey && (
        <>
          <input type="hidden" name="cf-turnstile-response" value={token ?? ""} />
          <Turnstile siteKey={siteKey} resetKey={resetKey} onToken={setToken} />
        </>
      )}
      <FormMessage state={state} />
      <button type="submit" disabled={pending || waitingForCaptcha} className={`${primaryButton} w-full disabled:cursor-not-allowed disabled:opacity-60`}>
        {pending ? pendingLabel : waitingForCaptcha ? "Проверяем, что вы не робот…" : submitLabel}
      </button>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  return (
    <AuthForm action={signIn} submitLabel="Войти" pendingLabel="Входим…">
      {(state, pending) => (
        <>
          {next && <input type="hidden" name="next" value={next} />}
          <EmailField state={state} disabled={pending} autoFocus />
          <PasswordField
            name="password"
            label="Пароль"
            autoComplete="current-password"
            state={state}
            disabled={pending}
            aside={
              <Link href="/forgot-password" className={`text-xs ${linkClass}`}>
                Забыли пароль?
              </Link>
            }
          />
        </>
      )}
    </AuthForm>
  );
}

export function SignUpForm() {
  return (
    <AuthForm action={signUp} submitLabel="Зарегистрироваться" pendingLabel="Создаём аккаунт…">
      {(state, pending) => (
        <>
          <EmailField state={state} disabled={pending} autoFocus />
          <PasswordField name="password" label="Пароль" autoComplete="new-password" hint={PASSWORD_HINT} state={state} disabled={pending} isNew />
          <PasswordField name="confirmPassword" label="Пароль ещё раз" autoComplete="new-password" state={state} disabled={pending} isNew />
        </>
      )}
    </AuthForm>
  );
}

export function ForgotPasswordForm() {
  return (
    <AuthForm action={requestPasswordReset} submitLabel="Отправить ссылку" pendingLabel="Отправляем…">
      {(state, pending) => <EmailField state={state} disabled={pending} autoFocus />}
    </AuthForm>
  );
}

export function ResetPasswordForm() {
  return (
    <AuthForm action={setNewPassword} submitLabel="Сохранить пароль" pendingLabel="Сохраняем…" captcha={false}>
      {(state, pending) => (
        <>
          <PasswordField name="password" label="Новый пароль" autoComplete="new-password" hint={PASSWORD_HINT} state={state} disabled={pending} isNew />
          <PasswordField name="confirmPassword" label="Новый пароль ещё раз" autoComplete="new-password" state={state} disabled={pending} isNew />
        </>
      )}
    </AuthForm>
  );
}

export function ChangePasswordForm() {
  return (
    <AuthForm action={changePassword} submitLabel="Изменить пароль" pendingLabel="Сохраняем…" captcha={false}>
      {(state, pending) => (
        <>
          <PasswordField name="currentPassword" label="Текущий пароль" autoComplete="current-password" state={state} disabled={pending} />
          <PasswordField name="password" label="Новый пароль" autoComplete="new-password" hint={PASSWORD_HINT} state={state} disabled={pending} isNew />
          <PasswordField name="confirmPassword" label="Новый пароль ещё раз" autoComplete="new-password" state={state} disabled={pending} isNew />
        </>
      )}
    </AuthForm>
  );
}
