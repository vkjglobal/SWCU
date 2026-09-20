import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveSiteNotice } from "../actions";
import { formatFijiDateTime } from "@/lib/fiji-time";
import { AdminWorkflowNotice } from "@/components/admin-workflow-notice";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";

export default async function SiteNoticeAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const notice = await db.siteNotice.findUnique({ where: { tenantId: tenant.id } });
  const draft = await db.cmsDraft.findFirst({ where: { tenantId: tenant.id, kind: "SITE_NOTICE", targetId: `${tenant.id}:site-notice`, status: { in: ["DRAFT", "RETURNED_FOR_CHANGES"] } }, select: { revision: true } });
  const editor = membership.role === "EDITOR";
  return (
    <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12">
      <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
      <p className="eyebrow mt-8">Site Notice</p><h1 className="mt-2 font-heading text-4xl font-bold text-deep-navy">A clear message for every public page</h1>
      <p className="mt-2 text-sm text-charcoal/65">Times are entered and displayed in Fiji local time (UTC+12).</p>
      <AdminWorkflowNotice editor={editor} />
      <AdminActionForm action={saveSiteNotice} className="mt-8 max-w-2xl space-y-4 rounded-card border border-deep-navy/10 bg-white p-6 shadow-card" successMessage="Site Notice saved.">
        <input type="hidden" name="revision" value={draft?.revision ?? ""} />
        <label className="block text-sm font-semibold">Message<textarea name="message" defaultValue={notice?.message} required maxLength={280} className="mt-2 min-h-28 w-full rounded border p-3" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Button Text<input name="actionText" defaultValue={notice?.actionText ?? ""} className="mt-2 w-full rounded border p-2" /></label><label className="text-sm font-semibold">Button Link<input name="actionUrl" defaultValue={notice?.actionUrl ?? ""} className="mt-2 w-full rounded border p-2" /></label><label className="text-sm font-semibold">Start Date &amp; Time<input name="startsAt" defaultValue={formatFijiDateTime(notice?.startsAt)} type="datetime-local" className="mt-2 w-full rounded border p-2" /></label><label className="text-sm font-semibold">End Date &amp; Time<input name="endsAt" defaultValue={formatFijiDateTime(notice?.endsAt)} type="datetime-local" className="mt-2 w-full rounded border p-2" /></label></div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input name="isEnabled" type="checkbox" defaultChecked={notice?.isEnabled} /> {editor ? "Prepare for approval" : "Show notice when scheduled"}</label>
        <AdminSubmitButton pendingLabel={editor ? "Saving draft…" : "Publishing…"} className="rounded bg-swcu-blue px-5 py-3 font-semibold text-white">{editor ? "Save Draft" : "Publish notice"}</AdminSubmitButton>
      </AdminActionForm>
    </div></main>
  );
}