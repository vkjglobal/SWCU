"use client";

import { useState, type FormEvent } from "react";

const GENERIC_ERROR = "Activation could not be completed. Check the activation details or try again later.";

export function ProductionAdminActivationForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [resetLink, setResetLink] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const secret = String(form.get("activationSecret") ?? "");

    try {
      if (window.location.protocol !== "https:") {
        setError(GENERIC_ERROR);
        return;
      }
      const response = await fetch("/api/admin/production-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
        cache: "no-store",
      });
      const result = await response.json() as { resetLink?: unknown };
      if (!response.ok || typeof result.resetLink !== "string") {
        setError(GENERIC_ERROR);
        return;
      }
      setResetLink(result.resetLink);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (resetLink) {
    return (
      <section className="w-full max-w-md space-y-5 rounded-card bg-white p-7 shadow-card">
        <h1 className="font-heading text-2xl font-bold text-deep-navy">Administrator activation ready</h1>
        <p className="text-sm leading-6 text-charcoal/70">
          Continue now to establish the production Administrator password. The one-time setup link expires in 60 minutes.
        </p>
        <a className="button-primary inline-flex" href={resetLink} rel="noreferrer">
          Continue to set password
        </a>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-card bg-white p-7 shadow-card">
      <div>
        <h1 className="font-heading text-2xl font-bold text-deep-navy">Production Administrator activation</h1>
        <p className="mt-2 text-sm leading-6 text-charcoal/70">
          Enter the temporary activation secret supplied for this production setup.
        </p>
      </div>
      {error && <p role="alert" aria-live="polite" className="rounded-lg border border-swcu-red/30 bg-swcu-red/5 p-3 text-sm text-swcu-red">{error}</p>}
      <label className="block text-sm font-semibold">
        Activation secret
        <input
          name="activationSecret"
          type="password"
          required
          minLength={32}
          maxLength={512}
          autoComplete="off"
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <button type="submit" disabled={pending} className="button-primary disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? "Preparing secure setup…" : "Prepare password setup"}
      </button>
    </form>
  );
}