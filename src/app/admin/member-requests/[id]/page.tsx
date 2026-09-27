import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient, MemberAppServiceError } from "@/lib/member-app-admin";
import type { MemberRequestDetail } from "@/lib/member-app-admin-contract";
import { addMemberInternalNoteAction, openMemberAttachmentAction } from "@/app/admin/member-services/actions";
import { MemberServicesPrivateForm } from "@/components/member-services-private-form";
import { Field, inputClass, MemberServiceBadge, MemberServiceLoadError, MemberServiceNotice } from "@/components/member-services-ui";
import { MemberServicesRequestUpdate } from "@/components/member-services-request-update";
import { AdminShell } from "../../admin-shell";

export default async function MemberRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const { id } = await params;
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
  return <AdminShell role={membership.role} title={request?.reference ?? "Member Request"} intro="Review the request and keep member-facing updates separate from staff notes.">
    <Link href="/admin/member-requests" className="mt-4 inline-block text-sm font-semibold text-swcu-blue">← Member Requests</Link>
    {!client ? <div className="mt-6"><MemberServiceNotice /></div> : loadError ? <MemberServiceLoadError /> : !request ? <MemberServiceLoadError /> : <>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-heading text-xl font-bold text-deep-navy">Request details</h2><MemberServiceBadge status={request.status} /></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-charcoal/60">Member</dt><dd>{request.member.name} · {request.member.identifier}</dd></div>
            <div><dt className="font-semibold text-charcoal/60">Request type</dt><dd>{request.type}</dd></div>
            <div><dt className="font-semibold text-charcoal/60">Submitted</dt><dd>{new Date(request.submittedAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</dd></div>
            <div><dt className="font-semibold text-charcoal/60">Last updated</dt><dd>{new Date(request.updatedAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</dd></div>
          </dl>
          <h3 className="mt-6 font-semibold text-deep-navy">Submitted information</h3>
          <dl className="mt-2 divide-y divide-deep-navy/10">{Object.entries(request.fields).map(([key, value]) => <div key={key} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(9rem,0.7fr)_1fr]"><dt className="font-semibold text-charcoal/70">{key}</dt><dd className="whitespace-pre-wrap break-words">{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl>
          <h3 className="mt-6 font-semibold text-deep-navy">Attachments</h3>
          {request.attachments.length === 0 ? <p className="mt-2 text-sm text-charcoal/65">No attachments were included.</p> : <ul className="mt-2 space-y-2">{request.attachments.map((attachment) => <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-soft-blue-grey p-3 text-sm"><span>{attachment.name}</span><MemberServicesPrivateForm submitAction={openMemberAttachmentAction} className="inline-flex" submitLabel="Open securely"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="attachmentId" value={attachment.id} /></MemberServicesPrivateForm></li>)}</ul>}
        </div>
        <div className="space-y-6">
          <section className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
            <h2 className="font-heading text-xl font-bold text-deep-navy">Update request</h2>
            <MemberServicesRequestUpdate id={request.id} status={request.status} memberMessage={request.memberMessage} />
          </section>
          <section className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
            <h2 className="font-heading text-xl font-bold text-deep-navy">Internal staff note</h2>
            <p className="mt-1 text-sm text-charcoal/65">Only staff can see these notes.</p>
            <MemberServicesPrivateForm submitAction={addMemberInternalNoteAction} className="mt-4 grid gap-4" submitLabel="Add internal note">
              <input type="hidden" name="id" value={request.id} />
              <Field label="Note"><textarea name="note" rows={3} required className={inputClass} /></Field>
            </MemberServicesPrivateForm>
            {request.internalNotes.length > 0 && <ul className="mt-5 space-y-3 border-t border-deep-navy/10 pt-4">{request.internalNotes.map((note) => <li key={note.id} className="text-sm"><p className="whitespace-pre-wrap">{note.text}</p><p className="mt-1 text-xs text-charcoal/60">{note.author} · {new Date(note.createdAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</p></li>)}</ul>}
          </section>
        </div>
      </section>
      <section className="mt-6 rounded-card border border-deep-navy/10 bg-white p-5 shadow-card"><h2 className="font-heading text-xl font-bold text-deep-navy">Request history</h2>{request.history.length === 0 ? <p className="mt-3 text-sm text-charcoal/65">No updates recorded yet.</p> : <ol className="mt-3 space-y-3">{request.history.map((event) => <li key={event.id} className="border-l-2 border-swcu-blue/25 pl-4 text-sm"><p>{event.description}</p><p className="mt-1 text-xs text-charcoal/60">{event.actor} · {new Date(event.createdAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</p></li>)}</ol>}</section>
    </>}
  </AdminShell>;
}