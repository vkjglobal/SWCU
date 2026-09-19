"use client";

import { useActionState } from "react";
import { initiateStaffPasswordResetAction } from "@/app/admin/actions";

type State = { resetLink?: string | null; deliveryReady?: boolean; error?: string };

export function StaffResetInitiation({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(async (_previous, form) => {
    try {
      return await initiateStaffPasswordResetAction(form);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Reset initiation failed." };
    }
  }, {});
  return <><form action={action}><input type="hidden" name="membershipId" value={membershipId}/><button className="rounded-lg border border-deep-navy/15 px-3 py-1 text-sm font-semibold text-charcoal" type="submit" disabled={pending}>{pending ? "Preparing…" : "Start password reset"}</button></form>{state.resetLink && <p className="basis-full rounded bg-ocean-teal/10 p-2 text-xs">Secure link created for one-time out-of-band delivery (it will not be shown again): <span className="break-all">{state.resetLink}</span></p>}{state.error && <p className="basis-full text-xs text-swcu-red">{state.error}</p>}</>;
}