"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      }),
    });

    setPending(false);

    if (!response.ok) {
      setError("The email or password was not recognised.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
      <div>
        <label htmlFor="email" className="block font-semibold text-deep-navy">
          Staff email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-2 min-h-12 w-full rounded-lg border border-deep-navy/20 px-3"
        />
      </div>
      <div>
        <label htmlFor="password" className="block font-semibold text-deep-navy">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 min-h-12 w-full rounded-lg border border-deep-navy/20 px-3"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-swcu-red/30 bg-swcu-red/5 p-3 text-sm">
          {error}
        </p>
      )}
      <button type="submit" className="button-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in to SWCU CMS"}
      </button>
      <p className="text-sm text-charcoal/65">
        Staff accounts are created by an authorised SWCU Administrator. There is no
        public registration.
      </p>
    </form>
  );
}