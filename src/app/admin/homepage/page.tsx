import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import {
  removeHeroSlide,
  removeHighlight,
  removeService,
  reorderHeroSlide,
  replaceHeroSlide,
  saveHighlight,
  saveService,
  toggleHeroSlide,
  uploadHeroSlide,
} from "../actions";
import { AdminWorkflowNotice } from "@/components/admin-workflow-notice";
import { AdminMediaUpload, ConfirmSubmitButton } from "@/components/admin-media-upload";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";

export default async function HomepageAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant);
  const [slides, highlights, services] = await Promise.all([
    db.homeHeroSlide.findMany({ where: { tenantId: tenant.id, mediaAssetId: { not: null } }, orderBy: { sortOrder: "asc" } }),
    db.homeHighlight.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } }),
    db.service.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } }),
  ]);
  const heroDrafts = await db.cmsDraft.findMany({ where: { tenantId: tenant.id, kind: "HERO", status: { in: ["DRAFT", "RETURNED_FOR_CHANGES"] } }, select: { targetId: true, revision: true } });
  const heroRevision = (id: string) => heroDrafts.find((draft) => draft.targetId === id)?.revision ?? "";
  const editor = membership.role === "EDITOR";
  return (
    <main className="min-h-screen bg-soft-blue-grey">
      <div className="site-container py-12">
        <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
        <p className="eyebrow mt-8">Homepage</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-deep-navy">Homepage content</h1>
        <AdminWorkflowNotice editor={editor} />
        <section className="mt-10 rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
          <h2 className="font-heading text-xl font-bold text-deep-navy">Hero images</h2>
          <p className="mt-1 text-sm text-charcoal/65">Up to four CMS-managed images. A file is not uploaded until you choose Upload image.</p>
          <div className="mt-5 rounded-xl border border-dashed border-deep-navy/20 p-4">
            <p className="font-semibold text-deep-navy">Add a hero image</p>
            {!slides.length && <p className="mt-1 text-sm text-charcoal/65">No image uploaded.</p>}
            <AdminMediaUpload action={uploadHeroSlide} buttonLabel={editor ? "Save draft" : "Upload image"}>
              <label className="block text-sm font-semibold">Image description<input name="altText" required maxLength={200} className="mt-1 w-full rounded border p-2" placeholder="Describe the image for members using assistive technology" /></label>
            </AdminMediaUpload>
          </div>
          <div className="mt-5 space-y-3">
            {slides.map((slide) => (
              <div key={slide.id} className="rounded-xl bg-soft-blue-grey p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-3"><img src={`/api/media/${slide.mediaAssetId}`} alt="" className="h-20 w-28 rounded-lg object-cover" /><div><p className="font-semibold text-deep-navy">{slide.altText}</p><p className="mt-1 text-sm text-charcoal/65">{slide.isEnabled ? "Published" : "Hidden"} · Position {slide.sortOrder + 1}</p></div></div>
                  <div className="flex flex-wrap items-center gap-3">
                    {slides.length > 1 && <AdminActionForm action={reorderHeroSlide} className="flex items-center gap-2" successMessage="Hero position saved."><input type="hidden" name="id" value={slide.id} /><input type="hidden" name="revision" value={heroRevision(slide.id)} /><label className="sr-only" htmlFor={`order-${slide.id}`}>Position</label><input id={`order-${slide.id}`} name="sortOrder" defaultValue={slide.sortOrder} className="w-14 rounded border p-1 text-center" /><AdminSubmitButton pendingLabel="Saving…" className="text-xs font-semibold text-swcu-blue">{editor ? "Save draft" : "Save position"}</AdminSubmitButton></AdminActionForm>}
                    <AdminActionForm action={toggleHeroSlide} className="contents" successMessage={`Hero image ${slide.isEnabled ? "hidden" : "shown"}.`}><input type="hidden" name="id" value={slide.id} /><input type="hidden" name="revision" value={heroRevision(slide.id)} /><input type="hidden" name="isEnabled" value={String(!slide.isEnabled)} /><AdminSubmitButton pendingLabel="Saving…" className="text-xs font-semibold text-swcu-red">{editor ? `Propose ${slide.isEnabled ? "hide" : "show"}` : slide.isEnabled ? "Hide image" : "Show image"}</AdminSubmitButton></AdminActionForm>
                    <AdminActionForm action={removeHeroSlide} className="contents" successMessage="Hero image removed."><input type="hidden" name="id" value={slide.id} /><input type="hidden" name="revision" value={heroRevision(slide.id)} /><ConfirmSubmitButton label={editor ? "Propose removal" : "Remove image"} message="Remove this hero image?" className="text-xs font-semibold text-swcu-red" /></AdminActionForm>
                  </div>
                </div>
                <div className="mt-4 border-t border-deep-navy/10 pt-4"><AdminMediaUpload action={replaceHeroSlide} buttonLabel={editor ? "Propose replacement" : "Replace image"}><input type="hidden" name="slideId" value={slide.id} /><input type="hidden" name="revision" value={heroRevision(slide.id)} /><label className="block text-sm font-semibold">Image description<input name="altText" defaultValue={slide.altText} required maxLength={200} className="mt-1 w-full rounded border p-2" /></label></AdminMediaUpload></div>
              </div>
            ))}
          </div>
        </section>
        {membership.role === "ADMINISTRATOR" && (
          <>
            <section className="mt-6 rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
              <h2 className="font-heading text-xl font-bold text-deep-navy">Highlights (Administrator)</h2>
              <AdminActionForm action={saveHighlight} className="mt-5 grid gap-3 sm:grid-cols-4" successMessage="Highlight saved."><input name="value" placeholder="1,500+" required className="rounded border p-2" /><input name="label" placeholder="Members" required className="rounded border p-2" /><input name="sortOrder" type="number" defaultValue="0" className="rounded border p-2" /><label className="flex items-center gap-2 text-sm"><input name="isEnabled" type="checkbox" defaultChecked /> Visible <AdminSubmitButton pendingLabel="Saving…" className="rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Add</AdminSubmitButton></label></AdminActionForm>
              <div className="mt-4 space-y-2">{highlights.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded bg-soft-blue-grey p-2"><AdminActionForm action={saveHighlight} className="flex flex-wrap gap-2" successMessage="Highlight saved."><input type="hidden" name="id" value={item.id} /><input name="value" defaultValue={item.value} className="w-24 rounded border p-1" /><input name="label" defaultValue={item.label} className="w-40 rounded border p-1" /><input name="sortOrder" type="number" defaultValue={item.sortOrder} className="w-16 rounded border p-1" /><label className="text-xs"><input name="isEnabled" type="checkbox" defaultChecked={item.isEnabled} /> Visible</label><AdminSubmitButton pendingLabel="Saving…" className="text-xs font-semibold text-swcu-blue">Save</AdminSubmitButton></AdminActionForm><AdminActionForm action={removeHighlight} className="contents" successMessage="Highlight removed."><input type="hidden" name="id" value={item.id} /><ConfirmSubmitButton label="Remove" message="Remove this live highlight?" className="text-xs font-semibold text-swcu-red" /></AdminActionForm></div>)}</div>
            </section>
            <section className="mt-6 rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
              <h2 className="font-heading text-xl font-bold text-deep-navy">Services</h2>
              <AdminActionForm action={saveService} className="mt-5 grid gap-3 sm:grid-cols-2" successMessage="Service saved."><input name="title" placeholder="Service title" required className="rounded border p-2" /><input name="icon" placeholder="Icon identifier" defaultValue="landmark" className="rounded border p-2" /><textarea name="description" placeholder="Short approved description" required className="rounded border p-2" /><input name="destination" placeholder="#services" className="rounded border p-2" /><input name="sortOrder" type="number" defaultValue="0" className="rounded border p-2" /><label className="flex items-center gap-2 text-sm"><input name="isEnabled" type="checkbox" defaultChecked /> Visible</label><AdminSubmitButton pendingLabel="Saving…" className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Add service</AdminSubmitButton></AdminActionForm>
              <ul className="mt-5 space-y-2 text-sm">{services.map((item) => <li key={item.id} className="border-b pb-2"><AdminActionForm action={saveService} className="grid gap-2 sm:grid-cols-2" successMessage="Service saved."><input type="hidden" name="id" value={item.id} /><input name="title" defaultValue={item.title} required className="rounded border p-1" /><input name="description" defaultValue={item.description} required className="rounded border p-1" /><input name="icon" defaultValue={item.icon} className="rounded border p-1" /><input name="destination" defaultValue={item.destination ?? ""} placeholder="#services" className="rounded border p-1" /><input name="sortOrder" type="number" defaultValue={item.sortOrder} className="rounded border p-1" /><label className="text-xs"><input name="isEnabled" type="checkbox" defaultChecked={item.isEnabled} /> Visible</label><AdminSubmitButton pendingLabel="Saving…" className="text-xs font-semibold text-swcu-blue">Save</AdminSubmitButton></AdminActionForm><AdminActionForm action={removeService} className="contents" successMessage="Service removed."><input type="hidden" name="id" value={item.id} /><ConfirmSubmitButton label="Remove" message="Remove this live service?" className="mt-1 text-xs font-semibold text-swcu-red" /></AdminActionForm></li>)}</ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}