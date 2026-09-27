import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient } from "@/lib/member-app-admin";
import { saveMemberDocumentAction } from "@/app/admin/member-services/actions";
import { MemberDocumentEditor } from "@/components/member-services-editors";
import { AdminShell } from "../../admin-shell";

export default async function NewMemberDocumentPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  return <AdminShell role={membership.role} title="Add member document" intro="Upload a document for private access in the Member App.">
    <Link href="/admin/member-documents" className="mt-4 inline-block text-sm font-semibold text-swcu-blue">← Member Documents</Link>
    <div className="mt-5"><MemberDocumentEditor connected={Boolean(client)} action={saveMemberDocumentAction} /></div>
  </AdminShell>;
}