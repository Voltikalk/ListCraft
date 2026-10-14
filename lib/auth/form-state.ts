/** Ответ серверного действия для формы аккаунта. */
export type AuthFormState = {
  status: "idle" | "error" | "success";
  /** Общее сообщение над кнопкой. */
  message?: string;
  /** Ошибки по полям: ключ — name поля. */
  fieldErrors?: Record<string, string>;
  /** Почта, которую вернуть в поле после ошибки. Пароли обратно не отдаём. */
  email?: string;
};

export const INITIAL_FORM_STATE: AuthFormState = { status: "idle" };
