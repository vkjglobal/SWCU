"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ServerAction = (formData: FormData) => Promise<unknown>;

type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function isRedirectError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT"),
  );
}

export function AdminActionForm({
  action,
  children,
  className,
  successMessage = "Changes saved successfully.",
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      try {
        await action(formData);
        return { status: "success", message: successMessage };
      } catch (error) {
        if (isRedirectError(error)) throw error;
        return {
          status: "error",
          message: error instanceof Error ? error.message : "The action could not be completed. Please try again.",
        };
      }
    },
    { status: "idle" },
  );

  return (
    <form action={formAction} className={className}>
      {children}
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={state.status === "error" ? "text-sm font-semibold text-swcu-red" : "text-sm font-semibold text-green-700"}
        >
          {state.message}
        </p>
      )}
      {pending && <span className="sr-only" role="status" aria-live="polite">Saving…</span>}
    </form>
  );
}

export function AdminSubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "button-primary",
  type = "submit",
  disabled = false,
  ariaLabel,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  type?: "submit" | "button";
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type={type} disabled={pending || disabled} aria-label={ariaLabel} className={`${className} admin-action-control disabled:cursor-not-allowed disabled:opacity-55`}>
      {pending ? pendingLabel : children}
    </button>
  );
}