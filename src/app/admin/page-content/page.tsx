import Link from "next/link";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";
import { db } from "@/lib/db";
import { savePageContentDraft } from "../actions";
import { getCmsDraftRevision } from "@/lib/cms-workflow";
import { CmsDraftKind } from "@/generated/prisma/client";
import { PAGE_CONTENT_SLOTS } from "@/lib/cms-workflow";

const slots = PAGE_CONTENT_SLOTS;

export default async function PageContentAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const content = await db.pageContent.findMany({ where: { tenantId: tenant.id } });
  const revisions = await Promise.all(slots.map(async (slot) => [slot, await getCmsDraftRevision({ tenant, kind: CmsDraftKind.PAGE_CONTENT, targetId: `${tenant.id}:page:${slot}` })] as const));
  const revisionMap = new Map(revisions);
  return <main className="site-container py-12">
    <Link href="/admin">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Page content</h1>
    <p className="mt-2 text-charcoal/70">Fixed content slots keep the public site safe and consistent. {membership.role === "EDITOR" ? "Your changes require Administrator approval." : "Administrator changes still use the approval workflow where applicable."}</p>
    <div className="mt-8 space-y-4">{slots.map((slot) => {
      const item = content.find((entry) => entry.slot === slot);
      return <form key={slot} action={savePageContentDraft} className="rounded-card bg-white p-5">
        <input type="hidden" name="slot" value={slot} />
        {revisionMap.get(slot) !== undefined && <input type="hidden" name="revision" value={revisionMap.get(slot)} />}
        <label className="text-sm font-semibold">Content area<input name="heading" defaultValue={item?.heading ?? ""} placeholder={slot.replaceAll("_", " ")} className="mt-1 w-full rounded border p-2" /></label>
        <label className="mt-3 block text-sm font-semibold">Approved copy<textarea name="body" defaultValue={item?.body ?? ""} rows={3} className="mt-1 w-full rounded border p-2" /></label>
        <button className="mt-3 rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save for review</button>
      </form>;
    })}</div>
  </main>;
}