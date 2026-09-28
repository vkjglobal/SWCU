import { headers } from "next/headers";
import { AdminShell } from "@/app/admin/admin-shell";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveAskSwcuAction } from "./actions";

export default async function AskSwcuAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const settings = await db.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { showAskSwcu: true },
  });
  const enabled = settings?.showAskSwcu ?? false;

  return (
    <AdminShell role="ADMINISTRATOR" title="Ask SWCU" intro="Manage whether the Ask SWCU assistant is shown on the public website.">
      <div className="mt-8 grid max-w-4xl gap-5 md:grid-cols-2">
        <section className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card md:col-span-2">
          <h2 className="font-heading text-xl font-bold text-deep-navy">Website visibility</h2>
          <p className="mt-2 text-sm text-charcoal/70">Current value: <strong>{enabled ? "ON" : "OFF"}</strong></p>
          <AdminActionForm action={saveAskSwcuAction} className="mt-5 flex flex-wrap items-end gap-4" successMessage="Ask SWCU setting saved.">
            <label className="grid gap-2 text-sm font-semibold text-deep-navy">
              Show Ask SWCU on website
              <select name="showAskSwcu" defaultValue={enabled ? "on" : "off"} className="min-h-11 min-w-40 rounded-lg border border-deep-navy/20 bg-white px-3">
                <option value="off">OFF</option>
                <option value="on">ON</option>
              </select>
            </label>
            <AdminSubmitButton className="button-primary min-h-11">Save setting</AdminSubmitButton>
          </AdminActionForm>
          <p className="mt-4 text-sm text-charcoal/70">Ask SWCU cannot be shown until the chatbot connection is ready.</p>
        </section>

        <section className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
          <h2 className="font-heading text-xl font-bold text-deep-navy">Chatbot connection</h2>
          <p className="mt-3 font-semibold text-swcu-red">Not connected</p>
          <p className="mt-2 text-sm text-charcoal/70">Ask SWCU is not connected to the chatbot service yet.</p>
          <p className="mt-2 text-sm text-charcoal/70">The chatbot will be connected after the final SWCU website is live and approved content has been used for training.</p>
        </section>
        <section className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
          <h2 className="font-heading text-xl font-bold text-deep-navy">Member App</h2>
          <p className="mt-3 text-sm text-charcoal/70">The same Ask SWCU assistant will also be available from Help in the Member App.</p>
          <p className="mt-2 text-sm font-semibold text-swcu-blue">Prepared — connection pending</p>
        </section>
      </div>
    </AdminShell>
  );
}