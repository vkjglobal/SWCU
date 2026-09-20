import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { uploadImage, replaceImage, retireImage } from "../actions";
import { AdminWorkflowNotice } from "@/components/admin-workflow-notice";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";
import { AdminFileSelector, AdminImagePreview, ConfirmSubmitButton } from "@/components/admin-media-upload";

export default async function MediaAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const editor = membership.role === "EDITOR";
  const assets = await db.mediaAsset.findMany({ where: { tenantId: tenant.id, retiredAt: null, mimeType: { in: ["image/jpeg", "image/png", "image/webp"] } }, orderBy: { createdAt: "desc" } });
  const drafts = await db.cmsDraft.findMany({ where: { tenantId: tenant.id, kind: "MEDIA", status: { in: ["DRAFT", "RETURNED_FOR_CHANGES"] } }, select: { targetId: true, revision: true } });
  const revisionFor = (id: string) => drafts.find((draft) => draft.targetId === id)?.revision ?? "";
  return <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12">
    <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Website Images</h1>
    <p className="mt-2 text-charcoal/65">Upload and maintain the images used across the SWCU website.</p>
    <AdminWorkflowNotice editor={editor} />
    <AdminActionForm action={uploadImage} className="mt-8 grid max-w-3xl gap-4 rounded-card bg-white p-6 shadow-card sm:grid-cols-2" successMessage="Image uploaded successfully."><AdminFileSelector label="Choose image" accept="image/jpeg,image/png,image/webp" imagePreview required /><label className="text-sm font-semibold text-deep-navy">Image use<select name="purpose" defaultValue="general" className="mt-1 w-full rounded-lg border p-2"><option value="hero">Homepage hero</option><option value="news">News image</option><option value="general">General image</option></select></label><label className="text-sm font-semibold text-deep-navy">Image description<input name="altText" className="mt-1 w-full rounded-lg border p-2" /></label><AdminSubmitButton pendingLabel="Uploading…" className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">{editor ? "Save Draft" : "Upload image"}</AdminSubmitButton></AdminActionForm>
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-card border border-swcu-blue/10 bg-white shadow-card"><AdminImagePreview src={`/api/media/${asset.id}`} alt={asset.altText ?? "Website image"} /><div className="space-y-4 p-4"><div><p className="truncate font-semibold text-deep-navy">{asset.originalFilename}</p><p className="mt-1 text-xs capitalize text-charcoal/60">{asset.purpose}{asset.width > 0 && asset.height > 0 ? ` · ${asset.width}×${asset.height}` : ""}</p>{asset.altText && <p className="mt-2 text-sm text-charcoal/70">{asset.altText}</p>}</div><div className="space-y-3 rounded-xl border border-deep-navy/10 p-3"><AdminActionForm action={replaceImage} className="space-y-3" successMessage="Image replaced successfully."><input type="hidden" name="mediaId" value={asset.id} /><input type="hidden" name="revision" value={revisionFor(asset.id)} /><AdminFileSelector label="Replace image" accept="image/jpeg,image/png,image/webp" imagePreview required /><label className="block text-sm font-semibold text-deep-navy">Image description<input name="altText" defaultValue={asset.altText ?? ""} className="mt-1 w-full rounded-lg border p-2 text-sm" /></label><AdminSubmitButton pendingLabel="Replacing…" className="rounded-lg border border-ocean-teal px-3 py-2 text-sm font-semibold text-ocean-teal">{editor ? "Propose replacement" : "Replace image"}</AdminSubmitButton></AdminActionForm><div className="border-t border-deep-navy/10 pt-3"><AdminActionForm action={retireImage} className="contents" successMessage="Image retired."><input type="hidden" name="mediaId" value={asset.id} /><input type="hidden" name="revision" value={revisionFor(asset.id)} /><ConfirmSubmitButton label={editor ? "Propose removal" : "Remove image"} message="Remove this website image?" className="text-sm font-semibold text-swcu-red underline" /></AdminActionForm></div></div></div></article>)}</div>
  </div></main>;
}