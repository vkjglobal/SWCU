"use client";

import { useState } from "react";
import { updateMemberRequestAction } from "@/app/admin/member-services/actions";
import { MemberServicesPrivateForm } from "@/components/member-services-private-form";
import { Field, inputClass } from "@/components/member-services-ui";
import { requestStatuses } from "@/lib/member-app-admin-contract";

export function MemberServicesRequestUpdate({ id, status, memberMessage }: { id: string; status: string; memberMessage: string | null }) {
  const [changeMessage, setChangeMessage] = useState(false);
  return <MemberServicesPrivateForm submitAction={updateMemberRequestAction} className="mt-4 grid gap-4" submitLabel="Save request update">
    <input type="hidden" name="id" value={id} />
    <Field label="Status"><select name="status" defaultValue={status} className={inputClass}>{requestStatuses.map((value) => <option key={value}>{value}</option>)}</select></Field>
    <label className="flex items-start gap-2 text-sm font-semibold text-deep-navy"><input type="checkbox" name="changeMemberMessage" value="on" checked={changeMessage} onChange={(event) => setChangeMessage(event.target.checked)} className="mt-1" />Change the message shown to the member</label>
    <Field label="Message for the member"><textarea name={changeMessage ? "memberMessage" : undefined} disabled={!changeMessage} rows={4} defaultValue={memberMessage ?? ""} placeholder="Add a message only when you want the member to see it" className={inputClass} /></Field>
  </MemberServicesPrivateForm>;
}