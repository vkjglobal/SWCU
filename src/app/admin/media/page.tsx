/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { uploadImage, replaceImage, retireImage } from "../actions";
import { AdminWorkflowNotice } from "@/components/admin-workflow-notice";

export default async function MediaAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const editor = membership.role === "EDITOR";
  const assets = await db.mediaAsset.findMany({ where: { tenantId: tenant.id, retiredAt: null }, orderBy: { createdAt: "desc" } });
  const drafts = await db.cmsDraft.findMany({ where: { tenantId: tenant.id, kind: "MEDIA", status: { in: ["DRAFT", "RETURNED_FOR_CHANGES"] } }, select: { targetId: true, revision: true } });
  const revisionFor = (id: string) => drafts.find((draft) => draft.targetId === id)?.revision ?? "";
  return <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12">
    <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Media Library</h1>
    <p className="mt-2 text-charcoal/65">PDF forms are managed in Forms &amp; Documents.</p>
    <AdminWorkflowNotice editor={editor} />
    <form action={uploadImage} encType="multipart/form-data" className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 sm:grid-cols-3"><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" /><select name="purpose" defaultValue="general" className="rounded border p-2"><option value="hero">Homepage hero</option><option value="news">News image</option><option value="general">General image</option></select><input name="altText" placeholder="Accessible alt text" className="rounded border p-2" /><button className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">{editor ? "Save Draft" : "Publish image"}</button></form>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-card border bg-white shadow-card"><img src={`/api/media/${asset.id}`} alt={asset.altText ?? ""} className="aspect-[4/3] w-full object-cover" /><div className="space-y-3 p-4"><p className="font-semibold text-deep-navy">{asset.originalFilename}</p><p className="text-xs text-charcoal/60">{asset.purpose} · {asset.width}×{asset.height}</p><form action={replaceImage} encType="multipart/form-data" className="flex flex-wrap gap-2"><input type="hidden" name="mediaId" value={asset.id} /><input type="hidden" name="revision" value={revisionFor(asset.id)} /><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="max-w-44 text-xs" /><input name="altText" defaultValue={asset.altText ?? ""} placeholder="Alt text" className="min-w-0 flex-1 rounded border p-1 text-xs" /><button className="text-xs font-semibold text-ocean-teal">{editor ? "Propose replacement" : "Replace"}</button></form><form action={retireImage}><input type="hidden" name="mediaId" value={asset.id} /><input type="hidden" name="revision" value={revisionFor(asset.id)} /><button className="text-xs font-semibold text-swcu-red">{editor ? "Propose retirement" : "Retire image"}</button></form></div></article>)}</div>
  </div></main>;
}