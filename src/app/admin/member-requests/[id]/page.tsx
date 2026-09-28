import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient, MemberAppServiceError } from "@/lib/member-app-admin";
import type { MemberRequestDetail } from "@/lib/member-app-admin-contract";
import { addMemberInternalNoteAction } from "@/app/admin/member-services/actions";
import { MemberServicesPrivateForm } from "@/components/member-services-private-form";
import { Field, inputClass, MemberServiceBadge, MemberServiceLoadError, MemberServiceNotice } from "@/components/member-services-ui";
import { MemberServicesRequestUpdate } from "@/components/member-services-request-update";
import { AdminShell } from "../../admin-shell";
import type { ReactNode } from "react";

type SubmittedField = { key: string; label: string; value: unknown };
type MemberResponse = {
  id: string;
  message?: string | null;
  createdAt: string;
  attachments?: Array<{ id: string; name: string }>;
};
type MemberContactSummary = { email?: string | null; mobile?: string | null };

function fieldValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length ? <ul className="list-disc space-y-1 pl-5">{value.map((item, index) => <li key={index}>{fieldValue(item)}</li>)}</ul> : "—";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length ? <dl className="grid gap-1">{entries.map(([key, nested]) => <div key={key}><dt className="inline font-semibold">{key.replace(/([a-z])([A-Z])/g, "$1 $2")}: </dt><dd className="inline">{fieldValue(nested)}</dd></div>)}</dl> : "—";
  }
  return "—";
}

export default async function MemberRequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string; noted?: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const { id } = await params;
  const confirmation = await searchParams;
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  let request: MemberRequestDetail | null = null;
  let loadError = false;
  if (client) {
    try {
      request = await client.getRequest(id);
    } catch (error) {
      if (error instanceof MemberAppServiceError && error.code === "http" && error.status === 404) notFound();
      loadError = true;
    }
  }
  const detailData = request as (MemberRequestDetail & { orderedFields?: SubmittedField[]; responses?: MemberResponse[] }) | null;
  const contact = request ? request.member as MemberRequestDetail["member"] & MemberContactSummary : null;
  const submittedFields = detailData?.orderedFields ?? [];
  const responses = detailData?.responses ?? [];
  return <AdminShell role={membership.role} title={request?.reference ?? "Member Request"} intro="Review the request and keep member-facing updates separate from staff notes.">
    <Link href="/admin/member-requests" className="mt-4 inline-block text-sm font-semibold text-swcu-blue">← Member Requests</Link>
    {!client ? <div className="mt-6"><MemberServiceNotice /></div> : loadError ? <MemberServiceLoadError /> : !request ? <MemberServiceLoadError /> : <>
      {confirmation.updated === "1" && <p role="status" className="mt-4 rounded-lg border border-ocean-teal/20 bg-ocean-teal/5 p-3 text-sm font-semibold text-deep-navy">Request update saved. The status and member message below are the latest values from the Member App.</p>}
      {confirmation.noted === "1" && <p role="status" className="mt-4 rounded-lg border border-ocean-teal/20 bg-ocean-teal/5 p-3 text-sm font-semibold text-deep-navy">Internal note added and refreshed from the Member App.</p>}
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-heading text-xl font-bold text-deep-navy">Request details</h2><MemberServiceBadge status={request.status} /></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
             <div><dt className="font-semibold text-charcoal/60">Member</dt><dd>{request.member.name} · {request.member.identifier}{contact?.email && <span className="block break-words">{contact.email}</span>}{contact?.mobile && <span className="block">{contact.mobile}</span>}</dd></div>
            <div><dt className="font-semibold text-charcoal/60">Request type</dt><dd>{request.type}</dd></div>
            <div><dt className="font-semibold text-charcoal/60">Submitted</dt><dd>{new Date(request.submittedAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</dd></div>
            <div><dt className="font-semibold text-charcoal/60">Last updated</dt><dd>{new Date(request.updatedAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</dd></div>
          </dl>
          <h3 className="mt-6 font-semibold text-deep-navy">Submitted information</h3>
           <dl className="mt-2 divide-y divide-deep-navy/10">{submittedFields.map((field, index) => <div key={`${field.key}-${index}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(9rem,0.7fr)_1fr]"><dt className="font-semibold text-charcoal/70">{field.label}</dt><dd className="whitespace-pre-wrap break-words">{fieldValue(field.value)}</dd></div>)}</dl>
          <h3 className="mt-6 font-semibold text-deep-navy">Attachments</h3>
           {request.attachments.length === 0 ? <p className="mt-2 text-sm text-charcoal/65">No attachments were included.</p> : <ul className="mt-2 space-y-2">{request.attachments.map((attachment) => <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-soft-blue-grey p-3 text-sm"><span>{attachment.name}</span><a href={`/api/admin/member-requests/${encodeURIComponent(request.id)}/attachments/${encodeURIComponent(attachment.id)}`} className="font-semibold text-swcu-blue underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue">Open securely</a></li>)}</ul>}
           <h3 className="mt-6 font-semibold text-deep-navy">Member responses</h3>
           {responses.length === 0 ? <p className="mt-2 text-sm text-charcoal/65">No member responses have been submitted.</p> : <ol className="mt-2 space-y-3">{responses.map((response) => <li key={response.id} className="rounded-lg border border-deep-navy/10 p-3 text-sm"><p className="text-xs text-charcoal/60">{new Date(response.createdAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</p>{response.message && <p className="mt-2 whitespace-pre-wrap break-words">{response.message}</p>}{response.attachments && response.attachments.length > 0 && <ul className="mt-2 space-y-1">{response.attachments.map((attachment) => <li key={attachment.id}><a href={`/api/admin/member-requests/${encodeURIComponent(request.id)}/attachments/${encodeURIComponent(attachment.id)}`} className="font-semibold text-swcu-blue underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue">{attachment.name} (secure download)</a></li>)}</ul>}</li>)}</ol>}
        </div>
        <div className="space-y-6">
          <section className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
            <h2 className="font-heading text-xl font-bold text-deep-navy">Update request</h2>
             <div className="mt-3 rounded-lg bg-soft-blue-grey p-3 text-sm"><h3 className="font-semibold">Current message visible to member</h3><p className="mt-1 whitespace-pre-wrap break-words text-charcoal/75">{request.memberMessage || "No member-facing message."}</p></div>
            <MemberServicesRequestUpdate id={request.id} status={request.status} memberMessage={request.memberMessage} />
          </section>
          <section className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
            <h2 className="font-heading text-xl font-bold text-deep-navy">Internal staff note</h2>
            <p className="mt-1 text-sm text-charcoal/65">Only staff can see these notes.</p>
             <MemberServicesPrivateForm action={addMemberInternalNoteAction} className="mt-4 grid gap-4" submitLabel="Add internal note">
              <input type="hidden" name="id" value={request.id} />
              <Field label="Note"><textarea name="note" rows={3} required className={inputClass} /></Field>
            </MemberServicesPrivateForm>
             {request.internalNotes.length > 0 && <ul className="mt-5 space-y-3 border-t border-deep-navy/10 pt-4">{request.internalNotes.map((note) => <li key={note.id} className="text-sm"><p className="whitespace-pre-wrap">{note.text}</p><p className="mt-1 text-xs text-charcoal/60">{note.author ? `${note.author} · ` : ""}{new Date(note.createdAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</p></li>)}</ul>}
          </section>
        </div>
      </section>
      <section className="mt-6 rounded-card border border-deep-navy/10 bg-white p-5 shadow-card"><h2 className="font-heading text-xl font-bold text-deep-navy">Request history</h2>{request.history.length === 0 ? <p className="mt-3 text-sm text-charcoal/65">No updates recorded yet.</p> : <ol className="mt-3 space-y-3">{request.history.map((event) => <li key={event.id} className="border-l-2 border-swcu-blue/25 pl-4 text-sm"><p>{event.description}</p><p className="mt-1 text-xs text-charcoal/60">{event.actor} · {new Date(event.createdAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</p></li>)}</ol>}</section>
    </>}
  </AdminShell>;
}