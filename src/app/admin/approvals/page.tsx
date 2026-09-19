import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { archiveCmsDraft, publishCmsDraft, returnCmsDraft } from "@/app/admin/actions";
import { AdminShell, kindLabels, operationLabels, StatusBadge } from "@/app/admin/admin-shell";
import { resolveCmsDraftTarget } from "@/lib/cms-workflow";

function readable(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default async function ApprovalsPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const drafts = await db.cmsDraft.findMany({ where: { tenantId: tenant.id, status: "WAITING_FOR_APPROVAL" }, include: { creator: { select: { name: true, email: true } }, assignee: { select: { name: true, email: true } } }, orderBy: { submittedAt: "asc" } });
  const enriched = await Promise.all(drafts.map(async (draft) => {
    const current = await resolveCmsDraftTarget(tenant, draft.kind, draft.targetId);
    const payload = (draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)) ? draft.payload as Record<string, unknown> : {};
    const stale = Boolean(current && draft.publishedBaseFingerprint && current.updatedAt.toISOString() !== draft.publishedBaseFingerprint);
    const title = String(payload.title ?? payload.question ?? payload.altText ?? payload.purpose ?? kindLabels[draft.kind] ?? draft.kind);
    return { draft, current, payload, stale, title };
  }));
  return <AdminShell role={membership.role} title="Waiting for approval" intro="Review what will appear on the public site before you publish it.">
    {enriched.length === 0 ? <div className="mt-8 rounded-card border border-dashed border-deep-navy/20 bg-white p-10 text-center"><h2 className="font-heading text-xl font-bold text-deep-navy">Nothing is waiting</h2><p className="mt-2 text-charcoal/65">New submissions will appear here for review.</p></div> : <div className="mt-8 space-y-5">{enriched.map(({ draft, current, payload, stale, title }) => <article key={draft.id} className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
      {stale && <div className="mt-5 border-l-4 border-swcu-red bg-swcu-red/10 px-4 py-3 text-sm text-deep-navy"><strong>Published content has changed.</strong> Review the current version carefully before confirming publication.</div>}
       <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-xl font-bold text-deep-navy">{title}</h2><StatusBadge status={draft.status} /></div><p className="mt-1 text-sm text-charcoal/65">{kindLabels[draft.kind] ?? draft.kind} · {operationLabels[draft.operation] ?? draft.operation} · submitted {draft.submittedAt?.toLocaleString("en-FJ") ?? "not dated"}</p><p className="mt-1 text-sm text-charcoal/65">Editor: {draft.creator.name || draft.creator.email} · Assignee: {draft.assignee?.name || draft.assignee?.email || "Not assigned"}</p></div></div>
       {!current && draft.targetId && <div className="mt-5 border-l-4 border-swcu-red bg-swcu-red/10 px-4 py-3 text-sm text-deep-navy"><strong>This item has since been retired. This draft cannot be published.</strong></div>}
      <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-lg border border-deep-navy/10 bg-soft-blue-grey p-4"><h3 className="font-semibold text-deep-navy">Current published version</h3><dl className="mt-3 space-y-2 text-sm">{current ? Object.entries(current).filter(([k]) => !["id","tenantId","createdAt","updatedAt"].includes(k)).slice(0, 8).map(([key, value]) => <div key={key}><dt className="font-semibold text-charcoal/65">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="break-words">{readable(value)}</dd></div>) : <p className="text-charcoal/65">No current version</p>}</dl></div><div className="rounded-lg border border-swcu-blue/20 bg-white p-4"><h3 className="font-semibold text-deep-navy">Proposed version</h3><dl className="mt-3 space-y-2 text-sm">{Object.entries(payload).filter(([k]) => !["mediaAssetId"].includes(k)).map(([key, value]) => <div key={key}><dt className="font-semibold text-charcoal/65">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="break-words">{readable(value)}</dd></div>)}</dl></div></div>
      {draft.mediaAssetId && <p className="mt-4 rounded-lg bg-ocean-teal/10 px-4 py-3 text-sm text-deep-navy">A new file is included with this submission. Check it before publishing.</p>}
       <div className="mt-5 flex flex-wrap items-center gap-2">{(!draft.targetId || current) && <form action={publishCmsDraft}><input type="hidden" name="draftId" value={draft.id}/>{stale && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmPublishedChange" value="true" required/> I reviewed the changed published version</label>}<button className="button-primary" type="submit">Publish</button></form>}<form action={returnCmsDraft} className="flex gap-2"><input type="hidden" name="draftId" value={draft.id}/><input name="note" aria-label="Note for returned draft" placeholder="Optional note" className="rounded-lg border border-deep-navy/15 px-3 text-sm"/><button className="button-secondary" type="submit">Return for changes</button></form><form action={archiveCmsDraft}><input type="hidden" name="draftId" value={draft.id}/><button className="rounded-lg border border-swcu-red/30 px-4 py-2 font-semibold text-swcu-red" type="submit">Archive</button></form></div>
    </article>)}</div>}
  </AdminShell>;
}