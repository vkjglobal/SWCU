"use client";
/* eslint-disable @next/next/no-img-element -- local file previews use object URLs */

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type MediaAction = (formData: FormData) => Promise<unknown>;

type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export function AdminFileSelector({
  name = "file",
  accept,
  label,
  required = false,
  imagePreview = false,
}: {
  name?: string;
  accept: string;
  label: string;
  required?: boolean;
  imagePreview?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending } = useFormStatus();
  const [selection, setSelection] = useState<{ name: string; type: string; size: string; url?: string } | null>(null);
  useEffect(() => () => { if (selection?.url) URL.revokeObjectURL(selection.url); }, [selection?.url]);
  function choose(file?: File) {
    if (selection?.url) URL.revokeObjectURL(selection.url);
    setSelection(file ? {
      name: file.name, type: file.type || "File",
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      url: imagePreview && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    } : null);
  }
  return <div className="space-y-2">
    <span id={`${inputId}-label`} className="block text-sm font-semibold text-deep-navy">{label}</span>
    <div className="rounded-xl border border-dashed border-swcu-blue/35 bg-soft-blue-grey p-3">
      <input id={inputId} ref={inputRef} name={name} type="file" accept={accept} required={required} disabled={pending}
        aria-labelledby={`${inputId}-label`}
        onChange={(event) => choose(event.target.files?.[0])}
        className="sr-only" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="admin-file-control rounded-lg bg-white px-3 py-2 text-sm font-semibold text-swcu-blue shadow-sm ring-1 ring-swcu-blue/25 disabled:cursor-not-allowed disabled:opacity-55">
          {pending ? "Uploading…" : selection ? "Change file" : accept.includes("pdf") ? "Choose PDF" : "Choose image"}
        </button>
        <span className="min-w-0 text-sm text-charcoal/70" aria-live="polite">{selection ? selection.name : "No file selected"}</span>
        {selection && <button type="button" disabled={pending} onClick={() => { choose(); if (inputRef.current) inputRef.current.value = ""; }} className="admin-action-control text-sm font-semibold text-swcu-red underline disabled:cursor-not-allowed disabled:opacity-55">Clear</button>}
      </div>
      {selection && <div className="mt-3 flex items-center gap-3 border-t border-swcu-blue/10 pt-3 text-xs text-charcoal/65">
        {selection.url && <img src={selection.url} alt="" className="h-14 w-20 rounded-md object-cover" />}
        <span>{selection.type} · {selection.size}</span>
      </div>}
    </div>
  </div>;
}

export function AdminImagePreview({ src, alt }: { src: string; alt: string }) {
  const [available, setAvailable] = useState(true);
  return <div className="relative flex aspect-[4/3] items-center justify-center bg-soft-blue-grey">
    <span className="absolute text-sm font-semibold text-charcoal/55">Preview unavailable</span>
    {available && <img src={src} alt={alt} className="relative h-full w-full object-cover" onError={() => setAvailable(false)} />}
  </div>;
}

export function AdminMediaUpload({
  action,
  buttonLabel,
  inputLabel = "Choose image",
  children,
}: {
  action: MediaAction;
  buttonLabel: string;
  inputLabel?: string;
  children?: ReactNode;
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

  return <form action={formAction} className="space-y-4">
    <div><span className="block text-sm font-semibold">{inputLabel}</span><input ref={inputRef} name="file" type="file" accept="image/jpeg,image/png,image/webp" required aria-label={inputLabel} onChange={(event) => chooseFile(event.target.files?.[0])} className="sr-only" /><button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="admin-file-control mt-2 rounded-lg border border-swcu-blue/25 bg-soft-blue-grey px-3 py-2 text-sm font-semibold text-swcu-blue disabled:cursor-not-allowed disabled:opacity-55">{pending ? "Uploading…" : selection ? "Change image" : "Choose image"}</button></div>
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