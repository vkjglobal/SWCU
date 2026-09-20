import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { CmsDraftKind } from "@/generated/prisma/client";
import { isUtilityPageSlot } from "@/lib/utility-pages";
import { submitCmsDraft, withdrawCmsDraft } from "@/app/admin/actions";
import { AdminShell, kindLabels, operationLabels, StatusBadge } from "@/app/admin/admin-shell";

export default async function DraftsPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const allDrafts = membership.role === "EDITOR"
    ? await db.cmsDraft.findMany({ where: { tenantId: tenant.id, OR: [{ createdBy: membership.userId }, { assignedTo: membership.userId }] }, orderBy: { updatedAt: "desc" } })
    : await db.cmsDraft.findMany({ where: { tenantId: tenant.id }, include: { creator: { select: { name: true, email: true } } }, orderBy: { updatedAt: "desc" } });
  const drafts = membership.role === "EDITOR"
    ? allDrafts.filter((draft) => !(draft.kind === CmsDraftKind.PAGE_CONTENT && isUtilityPageSlot(typeof draft.payload === "object" && draft.payload && !Array.isArray(draft.payload) && typeof draft.payload.slot === "string" ? draft.payload.slot : draft.targetId?.split(":page:")[1] ?? "")))
    : allDrafts;
  return <AdminShell role={membership.role} title={membership.role === "EDITOR" ? "My drafts" : "Drafts"} intro={membership.role === "EDITOR" ? "Keep your work here until it is ready for an Administrator to approve." : "Inspect open submissions across the publishing desk."}>
    {drafts.length === 0 ? <div className="mt-8 rounded-card border border-dashed border-deep-navy/20 bg-white p-10 text-center"><h2 className="font-heading text-xl font-bold text-deep-navy">No drafts yet</h2><p className="mt-2 text-charcoal/65">Start a change from one of the content modules.</p></div> : <div className="mt-8 overflow-hidden rounded-card border border-deep-navy/10 bg-white shadow-card"><ul className="divide-y divide-deep-navy/10">{drafts.map((draft) => {
      const creator = membership.role === "ADMINISTRATOR" && "creator" in draft ? (draft as typeof draft & { creator: { name: string | null; email: string } }).creator : null;
      const editable = draft.status === "DRAFT" || draft.status === "RETURNED_FOR_CHANGES";
      const withdrawable = editable || draft.status === "WAITING_FOR_APPROVAL";
      return <li key={draft.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-heading font-bold text-deep-navy">{kindLabels[draft.kind] ?? draft.kind}</h2><StatusBadge status={draft.status} /></div><p className="mt-1 text-sm text-charcoal/65">{operationLabels[draft.operation] ?? draft.operation} · last updated {draft.updatedAt.toLocaleString("en-FJ")}{creator ? ` · ${creator.name || creator.email}` : ""}</p>{draft.administratorNote && <p className="mt-3 border-l-4 border-ocean-teal bg-ocean-teal/10 px-3 py-2 text-sm text-deep-navy"><strong>Note:</strong> {draft.administratorNote}</p>}</div><div className="flex flex-wrap gap-2">{editable && <><Link href="/admin" className="button-secondary">Edit in content module</Link><form action={submitCmsDraft}><input type="hidden" name="draftId" value={draft.id} /><button className="button-primary" type="submit">{draft.status === "DRAFT" ? "Submit for approval" : "Resubmit"}</button></form></>}{withdrawable && <form action={withdrawCmsDraft}><input type="hidden" name="draftId" value={draft.id} /><button className="rounded-lg border border-swcu-red/30 px-4 py-2 font-semibold text-swcu-red" type="submit">Withdraw</button></form>}</div></div></li>;
    })}</ul></div>}
  </AdminShell>;
}