"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { enabled: boolean; saved: boolean };

export function CalculatorAvailability({
  enabled: persisted,
  action,
}: {
  enabled: boolean;
  action: (desired: boolean) => Promise<Result>;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [enabled, setEnabled] = useState(persisted);
  const [lastPersisted, setLastPersisted] = useState(persisted);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // A server refresh can bring a newer database value without remounting this
  // control. Keep the confirmation visible while reconciling that value.
  if (persisted !== lastPersisted) {
    setLastPersisted(persisted);
    setEnabled(persisted);
  }

  async function change(desired: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const result = await action(desired);
      setEnabled(result.enabled);
      if (result.saved) {
        setMessage(result.enabled
          ? "Calculator is now available on the website."
          : "Calculator is now hidden from the website.");
      } else {
        setError("Could not change website availability. The saved setting is shown. Please try again.");
      }
    } catch {
      setEnabled(persisted);
      setError("Could not change website availability. Please refresh and try again.");
    } finally {
      busy.current = false;
      setPending(false);
      router.refresh();
    }
  }

  return <section className="rounded-2xl border border-deep-navy/10 bg-white px-4 py-4 shadow-sm sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap">
      <div className="min-w-0 lg:flex-1">
        <h2 className="font-heading text-xl font-bold text-deep-navy">Website availability</h2>
        <p className="mt-1 text-sm leading-5 text-charcoal/70">When ON, members can use the calculator on the Home page. When OFF, the Home page shows the current calculator holding message.</p>
      </div>
      <div className="flex w-full min-w-0 flex-col items-start gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${enabled ? "bg-ocean-teal/15 text-ocean-teal" : "bg-charcoal/10 text-charcoal/70"}`}>
          Currently {enabled ? "ON" : "OFF"}
        </span>
        <label className="flex min-h-12 max-w-full cursor-pointer items-center gap-2 font-semibold text-deep-navy">
          <span>Show calculator on website</span>
          <input type="checkbox" role="switch" aria-label="Show calculator on website" aria-checked={enabled}
            checked={enabled} disabled={pending} onChange={(event) => { void change(event.target.checked); }}
            className="size-6 cursor-pointer accent-swcu-blue disabled:cursor-wait" />
        </label>
      </div>
    </div>
    {pending && <p role="status" className="mt-2 text-sm text-charcoal/70">Saving website availability…</p>}
    {message && <p role="status" className="mt-2 text-sm font-semibold text-ocean-teal">{message}</p>}
    {error && <p role="alert" className="mt-2 text-sm font-semibold text-swcu-red">{error}</p>}
  </section>;
}