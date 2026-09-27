"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type FormState = { error?: string };
type PrivateAction = (previous: FormState, formData: FormData) => Promise<FormState | undefined>;
type SubmitAction = (formData: FormData) => Promise<unknown>;

function isRedirectError(error: unknown) {
  return Boolean(error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT"));
}

function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="button-primary disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "Saving…" : children}
    </button>
  );
}

export function MemberServicesPrivateForm({
  action,
  submitAction,
  children,
  disabled = false,
  className = "grid gap-5",
  submitLabel = "Save changes",
}: {
  action?: PrivateAction;
  submitAction?: SubmitAction;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(async (previous: FormState, formData: FormData): Promise<FormState> => {
    if (action) return (await action(previous, formData)) ?? {};
    if (submitAction) {
      try {
        await submitAction(formData);
        return {};
      } catch (error) {
        if (isRedirectError(error)) throw error;
        return { error: "save" };
      }
    }
    return { error: "save" };
  }, {});
  return (
    <form action={formAction} encType="multipart/form-data" className={className}>
      {children}
      {state.error && <p role="alert" className="text-sm font-semibold text-swcu-red">We could not save this change. Please try again.</p>}
      <SubmitButton disabled={disabled}>{submitLabel}</SubmitButton>
    </form>
  );
}