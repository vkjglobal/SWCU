import type { MemberDocument, MemberNotice } from "@/lib/member-app-admin-contract";
import { documentStatuses, noticeStatuses } from "@/lib/member-app-admin-contract";
import { MemberServicesPrivateForm } from "@/components/member-services-private-form";
import { Field, inputClass, MemberServiceNotice } from "@/components/member-services-ui";
import { MemberServicesMemberTargetPicker } from "@/components/member-services-member-target-picker";
import { formatFijiDateTime } from "@/lib/fiji-time";
import Link from "next/link";

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new RangeError("Invalid saved date.");
  return formatFijiDateTime(instant);
}

export function MemberNoticeEditor({ notice, connected, action }: {
  notice?: MemberNotice;
  connected: boolean;
  action: (previous: { error?: string }, formData: FormData) => Promise<{ error?: string } | undefined>;
}) {
  return <>
    {!connected && <div className="mb-5"><MemberServiceNotice /></div>}
    <MemberServicesPrivateForm action={action} disabled={!connected} submitLabel={notice ? "Save notice" : "Create notice"} className="grid gap-5 rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
      {notice && <input type="hidden" name="id" value={notice.id} />}
      <Field label="Title"><input name="title" required defaultValue={notice?.title} className={inputClass} /></Field>
      <Field label="Message"><textarea name="message" required rows={6} defaultValue={notice?.message} className={inputClass} /></Field>
      <MemberServicesMemberTargetPicker initialMember={notice?.member} initialAudience={notice?.audience ?? "All Members"} connected={connected} />
      {!notice && <Field label="Optional attachment"><input type="file" name="file" disabled={!connected} accept="application/pdf,image/jpeg,image/png,image/webp" className={inputClass} /></Field>}
      {notice?.attachment && <p className="text-sm">Existing attachment: <Link href={`/api/admin/member-notices/${encodeURIComponent(notice.id)}/attachment`} className="font-semibold text-swcu-blue underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue">{notice.attachment.name} (open securely)</Link><span className="block text-xs text-charcoal/65">Attachments cannot be replaced or removed while editing.</span></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Show from"><input type="datetime-local" name="showFrom" defaultValue={dateInputValue(notice?.showFrom)} className={inputClass} /></Field>
        <Field label="Show until"><input type="datetime-local" name="showUntil" defaultValue={dateInputValue(notice?.showUntil)} className={inputClass} /></Field>
      </div>
      <Field label="Status"><select name="status" defaultValue={notice?.storedStatus ?? notice?.status ?? "Draft"} className={inputClass}>{noticeStatuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
    </MemberServicesPrivateForm>
  </>;
}

export function MemberDocumentEditor({ document, connected, action }: {
  document?: MemberDocument;
  connected: boolean;
  action: (previous: { error?: string }, formData: FormData) => Promise<{ error?: string } | undefined>;
}) {
  return <>
    {!connected && <div className="mb-5"><MemberServiceNotice /></div>}
    <MemberServicesPrivateForm action={action} disabled={!connected} submitLabel={document ? "Save document" : "Create document"} className="grid gap-5 rounded-card border border-deep-navy/10 bg-white p-5 shadow-card">
      {document && <input type="hidden" name="id" value={document.id} />}
      <Field label="Title"><input name="title" required defaultValue={document?.title} className={inputClass} /></Field>
      <Field label="Short description"><textarea name="shortDescription" rows={3} defaultValue={document?.shortDescription} className={inputClass} /></Field>
      <MemberServicesMemberTargetPicker initialMember={document?.member} initialAudience={document?.audience ?? "All Members"} connected={connected} />
      <Field label="Document type"><input name="documentType" required defaultValue={document?.documentType} className={inputClass} /></Field>
      {!document && <Field label="File"><input type="file" name="file" required disabled={!connected} accept="application/pdf,image/jpeg,image/png,image/webp" className={inputClass} /></Field>}
      {document?.file && <p className="text-sm">Current file: <Link href={`/api/admin/member-documents/${encodeURIComponent(document.id)}/file`} className="font-semibold text-swcu-blue underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue">{document.file.name} (open securely)</Link><span className="block text-xs text-charcoal/65">Files cannot be replaced or removed while editing.</span></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Available from"><input type="datetime-local" name="availableFrom" defaultValue={dateInputValue(document?.availableFrom)} className={inputClass} /></Field>
        <Field label="Available until"><input type="datetime-local" name="availableUntil" defaultValue={dateInputValue(document?.availableUntil)} className={inputClass} /></Field>
      </div>
      <Field label="Status"><select name="status" defaultValue={document?.storedStatus ?? document?.status ?? "Draft"} className={inputClass}>{documentStatuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
    </MemberServicesPrivateForm>
  </>;
}