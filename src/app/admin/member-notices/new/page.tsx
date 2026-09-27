import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient } from "@/lib/member-app-admin";
import { saveMemberNoticeAction } from "@/app/admin/member-services/actions";
import { MemberNoticeEditor } from "@/components/member-services-editors";
import { AdminShell } from "../../admin-shell";

export default async function NewMemberNoticePage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  return <AdminShell role={membership.role} title="Create member notice" intro="Prepare a notice that appears privately in the Member App.">
    <Link href="/admin/member-notices" className="mt-4 inline-block text-sm font-semibold text-swcu-blue">← Member Notices</Link>
    <div className="mt-5"><MemberNoticeEditor connected={Boolean(client)} action={saveMemberNoticeAction} /></div>
  </AdminShell>;
}