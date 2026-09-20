"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type MediaAction = (formData: FormData) => Promise<unknown>;

type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export function AdminMediaUpload({
  action,
  buttonLabel,
  inputLabel = "Choose image",
  children,
}: {
  action: MediaAction;
  buttonLabel: string;
  inputLabel?: string;
  children?: React.ReactNode;
}) {
  const [selection, setSelection] = useState<{ name: string; type: string; size: string; url: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (_previous, form) => {
    try {
      await action(form);
      return { status: "success", message: "Image uploaded successfully." };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "The image could not be saved. Please try again." };
    }
  }, { status: "idle" });

  useEffect(() => () => {
    if (selection?.url) URL.revokeObjectURL(selection.url);
  }, [selection?.url]);

  function chooseFile(file: File | undefined) {
    if (selection?.url) URL.revokeObjectURL(selection.url);
    setSelection(file ? {
      name: file.name,
      type: file.type || "Image",
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      url: URL.createObjectURL(file),
    } : null);
  }

  function clearSelection() {
    chooseFile(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  return <form action={formAction} encType="multipart/form-data" className="space-y-4">
    <label className="block text-sm font-semibold">{inputLabel}<input ref={inputRef} name="file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => chooseFile(event.target.files?.[0])} className="mt-2 block w-full text-sm" /></label>
    {selection && <div className="grid gap-3 rounded-xl border border-swcu-blue/20 bg-soft-blue-grey p-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
      <img src={selection.url} alt="" className="h-20 w-28 rounded-lg object-cover" />
      <div className="text-sm"><p className="font-semibold text-deep-navy">{selection.name}</p><p className="text-charcoal/65">{selection.type} · {selection.size}</p></div>
      <button type="button" onClick={clearSelection} className="text-sm font-semibold text-swcu-blue underline">Change selection</button>
    </div>}
    {children}
    <button type="submit" disabled={pending || !selection} className="button-primary disabled:cursor-not-allowed disabled:opacity-55">{pending ? "Uploading…" : buttonLabel}</button>
    {state.status !== "idle" && <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "text-sm font-semibold text-swcu-red" : "text-sm font-semibold text-green-700"}>{state.message}</p>}
  </form>;
}

export function ConfirmSubmitButton({ label, message, className = "text-sm font-semibold text-swcu-red underline" }: { label: string; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-55`} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{pending ? "Saving…" : label}</button>;
}