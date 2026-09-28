"use client";

import { updateMemberRequestAction } from "@/app/admin/member-services/actions";
import { MemberServicesPrivateForm } from "@/components/member-services-private-form";
import { Field, inputClass } from "@/components/member-services-ui";
import { requestStatuses } from "@/lib/member-app-admin-contract";

export function MemberServicesRequestUpdate({ id, status, memberMessage }: { id: string; status: string; memberMessage: string | null }) {
  return <MemberServicesPrivateForm action={updateMemberRequestAction} className="mt-4 grid gap-4" submitLabel="Save request update">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="initialStatus" value={status} />
    <input type="hidden" name="initialMemberMessage" value={memberMessage ?? ""} />
    <Field label="Status"><select name="status" defaultValue={status} className={inputClass}>{requestStatuses.map((value) => <option key={value}>{value}</option>)}</select></Field>
    <Field label="Message for the member"><textarea name="memberMessage" maxLength={2000} rows={4} defaultValue={memberMessage ?? ""} placeholder="Optional message visible to the member" className={inputClass} /></Field>
    <p className="text-xs text-charcoal/65">Edit the message to notify the member, leave it unchanged for a status-only update, or clear it to remove it.</p>
  </MemberServicesPrivateForm>;
}