"use client";

import { useActionState, useEffect, useState } from "react";
import { completeStaffPasswordResetAction } from "@/app/admin/actions";

export function StaffResetForm({ membershipId }: { membershipId: string }) {
  const [token] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  const [state, action, pending] = useActionState<{ error?: string; completed: boolean }, FormData>(async (_previous, form) => {
    try {
      await completeStaffPasswordResetAction(form);
      return { completed: true };
    } catch (error) {
      return { completed: false, error: error instanceof Error ? error.message : "This password reset link is invalid or expired." };
    }
  }, { completed: false });
  useEffect(() => {
    if (token) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [token]);
  if (state.completed) return <section className="w-full max-w-md space-y-4 rounded-card bg-white p-7 shadow-card"><h1 className="font-heading text-2xl font-bold text-deep-navy">Password updated</h1><p className="text-sm text-charcoal/70">Your staff password has been updated. You can now sign in to the SWCU CMS.</p></section>;
  return <form action={action} className="w-full max-w-md space-y-4 rounded-card bg-white p-7 shadow-card"><h1 className="font-heading text-2xl font-bold text-deep-navy">Set your staff password</h1><p className="text-sm text-charcoal/70">This one-time link expires in 60 minutes and can only be used once.</p>{state.error && <p role="alert" className="rounded-lg border border-swcu-red/30 bg-swcu-red/5 p-3 text-sm text-swcu-red">{state.error}</p>}<input type="hidden" name="membershipId" value={membershipId}/><input type="hidden" name="token" value={token}/><label className="block text-sm font-semibold">New password<input name="password" type="password" minLength={12} required autoComplete="new-password" className="mt-1 w-full rounded border p-2"/></label><button className="button-primary" type="submit" disabled={!token || pending}>{pending ? "Saving…" : "Set password"}</button></form>;
}