"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { completeStaffPasswordResetAction } from "@/app/admin/actions";

export function StaffResetForm({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [clientError, setClientError] = useState("");
  const retainedToken = useRef("");
  const [state, action, pending] = useActionState(completeStaffPasswordResetAction, { completed: false });
  useEffect(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    if (fragmentToken) retainedToken.current = fragmentToken;
    if (!retainedToken.current) return;
    const setupToken = retainedToken.current;
    const timer = window.setTimeout(() => setToken(setupToken), 0);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!state.completed) return;
    const timer = window.setTimeout(() => router.replace("/admin/login?password-set=1"), 1500);
    return () => window.clearTimeout(timer);
  }, [router, state.completed]);

  function validateSubmission(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");
    let error = "";
    if (!membershipId || !token) error = "This setup link is invalid or has expired. Please request a new link.";
    else if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) error = "Use at least 12 characters with upper-case, lower-case and a number.";
    else if (password !== confirmation) error = "Passwords do not match.";
    if (error) {
      event.preventDefault();
      setClientError(error);
      return;
    }
    setClientError("");
  }

  if (state.completed) return <section className="w-full max-w-md space-y-4 rounded-card bg-white p-7 shadow-card"><h1 className="font-heading text-2xl font-bold text-deep-navy">Password set successfully.</h1><p className="text-sm text-charcoal/70">Redirecting you to the SWCU CMS sign-in page…</p></section>;
  const error = clientError || state.error || (!token ? "This setup link is invalid or has expired. Please request a new link." : "");
  return <form action={action} onSubmit={validateSubmission} noValidate className="w-full max-w-md space-y-4 rounded-card bg-white p-7 shadow-card"><h1 className="font-heading text-2xl font-bold text-deep-navy">Set your staff password</h1><p className="text-sm text-charcoal/70">This one-time link expires in 60 minutes and can only be used once.</p>{error && <p role="alert" className="rounded-lg border border-swcu-red/30 bg-swcu-red/5 p-3 text-sm text-swcu-red">{error}</p>}<input type="hidden" name="membershipId" value={membershipId}/><input type="hidden" name="token" value={token}/><label className="block text-sm font-semibold">New password<input name="password" type="password" required autoComplete="new-password" aria-describedby="password-requirements" className="mt-1 w-full rounded border p-2"/></label><p id="password-requirements" className="text-xs text-charcoal/65">Use at least 12 characters with upper-case, lower-case and a number.</p><label className="block text-sm font-semibold">Confirm new password<input name="confirmPassword" type="password" required autoComplete="new-password" className="mt-1 w-full rounded border p-2"/></label><button className="button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Set password"}</button></form>;
}