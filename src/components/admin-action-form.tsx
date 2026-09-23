"use client";

import { useActionState, useState, type FormEvent, type ReactNode } from "react";
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
      } finally {
        setUploading(false);
      }
    },
    { status: "idle" },
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (pending || uploading) {
      event.preventDefault();
      return;
    }
    const form = event.currentTarget;
    const file = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
    if (!file) return;
    event.preventDefault();
    setUploading(true);
    setUploadError(undefined);
    try {
      const upload = new FormData();
      upload.set("file", file);
      upload.set("document", file.type === "application/pdf" ? "true" : "false");
      upload.set("purpose", form.querySelector<HTMLInputElement>('[name="purpose"]')?.value || (form.querySelector('[name="expectedMediaId"]') ? "contact-map" : form.querySelector('[name="slideId"]') ? "hero" : "general"));
      upload.set("profile", form.querySelector('[name="photo"]') ? "true" : "false");
      upload.set("altText", form.querySelector<HTMLInputElement>('[name="altText"]')?.value || form.querySelector<HTMLInputElement>('[name="name"]')?.value || "");
      const response = await fetch("/api/admin/media/upload", { method: "POST", body: upload });
      const result = await response.json() as { mediaAssetId?: string; error?: string };
      if (!response.ok || !result.mediaAssetId) throw new Error(result.error || "The upload could not be processed.");
      const actionData = new FormData(form);
      form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => actionData.delete(input.name));
      actionData.set("mediaAssetId", result.mediaAssetId);
      actionData.set("uploadedMediaId", result.mediaAssetId);
      formAction(actionData);
    } catch (error) {
      setUploading(false);
      setUploadError(error instanceof Error ? error.message : "The upload could not be processed.");
    }
  }

  return (
    <form action={formAction} onSubmit={(event) => { void submit(event); }} className={className}>
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
      {uploadError && <p role="alert" aria-live="polite" className="text-sm font-semibold text-swcu-red">{uploadError}</p>}
      {(pending || uploading) && <span className="sr-only" role="status" aria-live="polite">Saving…</span>}
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