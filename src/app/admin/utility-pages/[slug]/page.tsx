import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CmsDraftStatus, CmsDraftKind } from "@/generated/prisma/client";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { getCmsDraftRevision } from "@/lib/cms-workflow";
import { UTILITY_PAGE_DEFINITIONS, getUtilityPageDefinition } from "@/lib/utility-pages";
import { AdminShell, StatusBadge } from "@/app/admin/admin-shell";
import { savePageContentDraft, submitCmsDraft, withdrawCmsDraft } from "@/app/admin/actions";
import { sanitizeRichText } from "@/lib/rich-text";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";

export const dynamicParams = false;
export function generateStaticParams() {
  return UTILITY_PAGE_DEFINITIONS.map(({ slug }) => ({ slug }));
}

function payloadText(payload: unknown, key: "heading" | "body") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function Preview({ heading, body, label }: { heading: string; body: string; label: string }) {
  return <section className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-heading text-xl font-bold text-deep-navy">{label}</h2>
      <span className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">Preview only</span>
    </div>
    <article className="prose prose-lg mt-5 max-w-none text-charcoal/80">
      {heading && <h3 className="display-heading text-2xl text-deep-navy">{heading}</h3>}
      {body ? <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }} /> : <p className="text-charcoal/60">No body copy saved.</p>}
    </article>
  </section>;
}

export default async function UtilityPageAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const definition = getUtilityPageDefinition(slug);
  if (!definition) notFound();
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const targetId = `${tenant.id}:page:${definition.slot}`;
  const [published, draft, revision] = await Promise.all([
    db.pageContent.findUnique({ where: { tenantId_slot: { tenantId: tenant.id, slot: definition.slot } } }),
    db.cmsDraft.findFirst({
      where: { tenantId: tenant.id, kind: CmsDraftKind.PAGE_CONTENT, targetId, status: { in: [CmsDraftStatus.DRAFT, CmsDraftStatus.WAITING_FOR_APPROVAL, CmsDraftStatus.RETURNED_FOR_CHANGES] } },
      orderBy: { updatedAt: "desc" },
    }),
    getCmsDraftRevision({ tenant, kind: CmsDraftKind.PAGE_CONTENT, targetId }),
  ]);
  const draftHeading = payloadText(draft?.payload, "heading");
  const draftBody = payloadText(draft?.payload, "body");
  const footerVisible = Boolean(published?.isPublished);

  return <AdminShell role={membership.role} title={definition.label} intro="This fixed utility page is Administrator-only. Draft changes stay private until they complete the existing approval and publishing workflow.">
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link href="/admin/utility-pages" className="button-secondary">← All utility pages</Link>
      <span className="rounded-full bg-deep-navy/5 px-3 py-1 text-sm font-semibold text-charcoal">{published?.isPublished ? "Published" : "Unpublished"}</span>
      <span className="text-sm text-charcoal/65">Footer link: {footerVisible ? "Visible" : "Hidden"}</span>
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <Preview label={published?.isPublished ? "Current published content" : "Current stored content · not public"} heading={published?.heading ?? ""} body={published?.body ?? ""} />
      {draft ? <Preview label={`Saved draft · ${draft.status.replaceAll("_", " ")}`} heading={draftHeading} body={draftBody} /> : <section className="rounded-card border border-dashed border-deep-navy/20 bg-white p-6"><h2 className="font-heading text-xl font-bold text-deep-navy">Saved draft</h2><p className="mt-3 text-charcoal/65">No saved draft exists for this page.</p></section>}
    </div>
    <section className="mt-6 rounded-card bg-white p-6 shadow-card">
      <h2 className="font-heading text-xl font-bold text-deep-navy">Edit fixed page content</h2>
      <p className="mt-2 text-sm text-charcoal/65">Save changes for review, then submit the draft from this page or My drafts. Publishing remains available only through Administrator approval.</p>
      <AdminActionForm action={savePageContentDraft} className="mt-5 space-y-4" successMessage="Utility page draft saved.">
        <input type="hidden" name="slot" value={definition.slot} />
        {revision !== undefined && <input type="hidden" name="revision" value={revision} />}
        <label className="block text-sm font-semibold">Heading<input name="heading" defaultValue={draft ? draftHeading : published?.heading ?? ""} placeholder={definition.label} className="mt-1 w-full rounded border p-2" /></label>
       <label className="block text-sm font-semibold">Body<p className="mt-1 text-xs font-normal text-charcoal/65">Paste approved Word content or type normally. Headings, lists, bold, italic and safe links are preserved without writing HTML.</p><RichTextEditor name="body" initialValue={draft ? draftBody : published?.body ?? ""} /></label>
        <AdminSubmitButton pendingLabel="Saving…" className="button-primary" type="submit" disabled={draft?.status === CmsDraftStatus.WAITING_FOR_APPROVAL}>Save for review</AdminSubmitButton>
        {draft?.status === CmsDraftStatus.WAITING_FOR_APPROVAL && <p className="text-sm text-charcoal/65">This draft is waiting for Administrator approval and cannot be edited until it is returned.</p>}
      </AdminActionForm>
      {draft && <div className="mt-5 flex flex-wrap gap-3">
        {(draft.status === CmsDraftStatus.DRAFT || draft.status === CmsDraftStatus.RETURNED_FOR_CHANGES) && <AdminActionForm action={submitCmsDraft} successMessage="Draft submitted for approval."><input type="hidden" name="draftId" value={draft.id} /><AdminSubmitButton pendingLabel="Submitting…" className="button-secondary" type="submit">{draft.status === CmsDraftStatus.DRAFT ? "Submit for approval" : "Resubmit for approval"}</AdminSubmitButton></AdminActionForm>}
        {(draft.status === CmsDraftStatus.DRAFT || draft.status === CmsDraftStatus.RETURNED_FOR_CHANGES || draft.status === CmsDraftStatus.WAITING_FOR_APPROVAL) && <AdminActionForm action={withdrawCmsDraft} successMessage="Draft withdrawn."><input type="hidden" name="draftId" value={draft.id} /><AdminSubmitButton pendingLabel="Withdrawing…" className="rounded-lg border border-swcu-red/30 px-4 py-2 font-semibold text-swcu-red" type="submit">Withdraw draft</AdminSubmitButton></AdminActionForm>}
        <StatusBadge status={draft.status} />
      </div>}
    </section>
  </AdminShell>;
}