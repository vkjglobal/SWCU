"use client";

import { useEffect, useState } from "react";
import { completeStaffPasswordResetAction } from "@/app/admin/actions";

export function StaffResetForm({ membershipId }: { membershipId: string }) {
  const [token] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  useEffect(() => {
    if (token) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [token]);
  return <form action={completeStaffPasswordResetAction} className="w-full max-w-md space-y-4 rounded-card bg-white p-7 shadow-card"><h1 className="font-heading text-2xl font-bold text-deep-navy">Set your staff password</h1><p className="text-sm text-charcoal/70">This secure link can only be used once.</p><input type="hidden" name="membershipId" value={membershipId}/><input type="hidden" name="token" value={token}/><label className="block text-sm font-semibold">New password<input name="password" type="password" minLength={12} required autoComplete="new-password" className="mt-1 w-full rounded border p-2"/></label><button className="button-primary" type="submit" disabled={!token}>Set password</button></form>;
}