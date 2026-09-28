import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient, MemberAppServiceError } from "@/lib/member-app-admin";
import type { MemberNotice } from "@/lib/member-app-admin-contract";
import { saveMemberNoticeAction } from "@/app/admin/member-services/actions";
import { MemberNoticeEditor } from "@/components/member-services-editors";
import { MemberServiceLoadError, MemberServiceNotice } from "@/components/member-services-ui";
import { AdminShell } from "../../admin-shell";

export default async function EditMemberNoticePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const { id } = await params;
  const confirmation = await searchParams;
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  let notice: MemberNotice | null = null;
  let loadError = false;
  if (client) {
    try {
      notice = await client.getNotice(id);
    } catch (error) {
      if (error instanceof MemberAppServiceError && error.code === "http" && error.status === 404) notFound();
      loadError = true;
    }
  }
  return <AdminShell role={membership.role} title={notice ? "Edit member notice" : "Member notice"} intro="Update the private notice and when members can see it.">
    <Link href="/admin/member-notices" className="mt-4 inline-block text-sm font-semibold text-swcu-blue">← Member Notices</Link>
    {!client ? <div className="mt-5"><MemberServiceNotice /></div> : loadError ? <MemberServiceLoadError /> : !notice ? <MemberServiceLoadError /> : <div className="mt-5">{confirmation.saved === "1" && <p role="status" className="mb-4 rounded-lg border border-ocean-teal/20 bg-ocean-teal/5 p-3 text-sm font-semibold text-deep-navy">Notice changes saved. The values below were reloaded from the Member App.</p>}<MemberNoticeEditor notice={notice} connected action={saveMemberNoticeAction} /></div>}
  </AdminShell>;
}