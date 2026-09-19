import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveFaq, removeFaq } from "../actions";
import { AdminWorkflowNotice } from "@/components/admin-workflow-notice";

export default async function FAQsAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const editor = membership.role === "EDITOR";
  const faqs = await db.fAQ.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } });
  return (
    <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12"><a href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</a><h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">FAQs</h1><AdminWorkflowNotice editor={editor} />
      <form action={saveFaq} className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6"><input name="question" placeholder="Question" required className="rounded border p-2" /><textarea name="answer" placeholder="Approved answer" required className="min-h-28 rounded border p-2" /><input name="sortOrder" type="number" defaultValue="0" className="rounded border p-2" /><label className="text-sm"><input name="isEnabled" type="checkbox" defaultChecked /> {editor ? "Ready for approval" : "Visible"}</label><button className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">{editor ? "Save Draft" : "Publish FAQ"}</button></form>
      <ul className="mt-8 space-y-3">{faqs.map((item) => <li key={item.id} className="rounded border bg-white p-4"><form action={saveFaq} className="grid gap-2"><input type="hidden" name="id" value={item.id} /><input name="question" defaultValue={item.question} required className="rounded border p-2" /><textarea name="answer" defaultValue={item.answer} required className="min-h-20 rounded border p-2" /><input name="sortOrder" type="number" defaultValue={item.sortOrder} className="rounded border p-2" /><label className="text-sm"><input name="isEnabled" type="checkbox" defaultChecked={item.isEnabled} /> {editor ? "Ready for approval" : "Visible"}</label><button className="w-fit text-sm font-semibold text-swcu-blue">{editor ? "Save Draft" : "Publish changes"}</button></form><form action={removeFaq} className="mt-2"><input type="hidden" name="id" value={item.id} /><button className="text-sm font-semibold text-swcu-red">{editor ? "Propose removal" : "Remove"}</button></form></li>)}</ul>
    </div></main>
  );
}