import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveNewsNotice, removeNewsNotice } from "../actions";
import { formatFijiDateTime } from "@/lib/fiji-time";
import { AdminWorkflowNotice } from "@/components/admin-workflow-notice";

export default async function NewsAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const editor = membership.role === "EDITOR";
  const news = await db.newsNotice.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" } });
  const drafts = await db.cmsDraft.findMany({ where: { tenantId: tenant.id, kind: "NEWS", status: { in: ["DRAFT", "RETURNED_FOR_CHANGES"] } }, select: { targetId: true, revision: true } });
  const revisionFor = (id?: string) => drafts.find((draft) => draft.targetId === id)?.revision ?? "";
  return <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12">
    <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">News &amp; Notices</h1>
    <AdminWorkflowNotice editor={editor} />
    <form action={saveNewsNotice} className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 shadow-card"><input name="title" placeholder="News title" required className="rounded border p-2" /><textarea name="summary" placeholder="Approved short summary" required className="min-h-28 rounded border p-2" /><input name="publishedAt" type="datetime-local" className="rounded border p-2" /><label className="text-sm"><input name="isPublished" type="checkbox" /> {editor ? "Ready for approval" : "Publish publicly"}</label><button className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">{editor ? "Save Draft" : "Publish news"}</button></form>
    <ul className="mt-8 space-y-3">{news.map((item) => <li key={item.id} className="rounded border bg-white p-4"><form action={saveNewsNotice} className="grid gap-2"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={revisionFor(item.id)} /><input name="title" defaultValue={item.title} required className="rounded border p-2" /><textarea name="summary" defaultValue={item.summary} required className="rounded border p-2" /><input name="publishedAt" type="datetime-local" defaultValue={formatFijiDateTime(item.publishedAt)} className="rounded border p-2" /><label className="text-sm"><input name="isPublished" type="checkbox" defaultChecked={item.isPublished} /> {editor ? "Ready for approval" : "Published"}</label><button className="w-fit text-sm font-semibold text-swcu-blue">{editor ? "Save Draft" : "Publish changes"}</button></form><form action={removeNewsNotice} className="mt-2"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={revisionFor(item.id)} /><button className="text-sm font-semibold text-swcu-red">{editor ? "Propose unpublish" : "Unpublish"}</button></form></li>)}</ul>
  </div></main>;
}