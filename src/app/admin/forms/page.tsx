import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { replaceFormDocument, saveFormDocument, uploadFormDocument, removeFormDocument, setFormPublicApproval } from "../actions";
import { AdminWorkflowNotice } from "@/components/admin-workflow-notice";

export default async function FormsAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const editor = membership.role === "EDITOR";
  const forms = await db.formDocument.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } });
  const drafts = await db.cmsDraft.findMany({ where: { tenantId: tenant.id, kind: "FORM_DOCUMENT", status: { in: ["DRAFT", "RETURNED_FOR_CHANGES"] } }, select: { targetId: true, revision: true } });
  const revisionFor = (id?: string) => drafts.find((draft) => draft.targetId === id)?.revision ?? "";
  return <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12">
    <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Forms &amp; Documents</h1>
    <p className="mt-2 text-sm text-charcoal/65">Only enabled documents with an uploaded PDF and deliberate public approval show a public download.</p><AdminWorkflowNotice editor={editor} />
    <form action={uploadFormDocument} encType="multipart/form-data" className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 shadow-card sm:grid-cols-2">
      <input name="title" placeholder="Approved form title" required className="rounded border p-2" /><input name="file" type="file" accept="application/pdf,.pdf" required className="rounded border p-2" /><textarea name="description" placeholder="Description" className="rounded border p-2" /><input name="category" placeholder="Category (e.g. ANNUAL_REPORT)" required className="rounded border p-2" /><input name="sortOrder" type="number" defaultValue="0" className="rounded border p-2" /><label className="text-sm"><input name="isAnnualReport" type="checkbox" /> Annual report</label><label className="text-sm"><input name="isEnabled" type="checkbox" defaultChecked /> Enabled/live</label><button className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">{editor ? "Save Draft" : "Save form"}</button>
    </form>
    <ul className="mt-8 max-w-3xl space-y-3">{forms.map((form) => <li key={form.id} className="rounded border bg-white p-4">
      <form action={saveFormDocument} className="grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={form.id} /><input type="hidden" name="revision" value={revisionFor(form.id)} /><input name="title" defaultValue={form.title} required className="rounded border p-2" /><textarea name="description" defaultValue={form.description ?? ""} className="rounded border p-2" /><input name="category" defaultValue={form.category ?? ""} required className="rounded border p-2" /><input name="mediaAssetId" defaultValue={form.mediaAssetId ?? ""} placeholder="PDF media ID" className="rounded border p-2" /><input name="sortOrder" type="number" defaultValue={form.sortOrder} className="rounded border p-2" /><label className="text-sm"><input name="isAnnualReport" type="checkbox" defaultChecked={form.isAnnualReport} /> Annual report</label><label className="text-sm"><input name="isEnabled" type="checkbox" defaultChecked={form.isEnabled} /> Enabled/live</label><button className="w-fit text-sm font-semibold text-swcu-blue">{editor ? "Save Draft" : "Save changes"}</button></form>
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-charcoal/60"><span>{form.category} · {form.isAnnualReport ? "Annual report" : "Ordinary form"} · {form.publicApprovedAt ? "Public approved" : "Not public approved"}</span>{!editor && <><form action={setFormPublicApproval}><input type="hidden" name="id" value={form.id}/><input type="hidden" name="approved" value={form.publicApprovedAt ? "false" : "true"}/><button className="font-semibold text-swcu-blue">{form.publicApprovedAt ? "Revoke public release" : "Approve public release"}</button></form><form action={removeFormDocument}><input type="hidden" name="id" value={form.id}/><button className="font-semibold text-swcu-red">Remove</button></form></>}</div>
      <div className="mt-3 flex gap-3"><form action={replaceFormDocument} encType="multipart/form-data" className="flex items-center gap-2"><input type="hidden" name="id" value={form.id}/><input type="hidden" name="revision" value={revisionFor(form.id)}/><input name="file" type="file" accept="application/pdf,.pdf" required className="max-w-44 text-xs"/><button className="font-semibold text-ocean-teal">{editor ? "Propose replacement" : "Replace PDF"}</button></form></div>
    </li>)}</ul>
  </div></main>;
}