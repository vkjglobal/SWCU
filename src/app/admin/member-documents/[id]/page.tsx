import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient, MemberAppServiceError } from "@/lib/member-app-admin";
import type { MemberDocument } from "@/lib/member-app-admin-contract";
import { saveMemberDocumentAction } from "@/app/admin/member-services/actions";
import { MemberDocumentEditor } from "@/components/member-services-editors";
import { MemberServiceLoadError, MemberServiceNotice } from "@/components/member-services-ui";
import { AdminShell } from "../../admin-shell";

export default async function EditMemberDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const { id } = await params;
  const confirmation = await searchParams;
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  let document: MemberDocument | null = null;
  let loadError = false;
  if (client) {
    try {
      document = await client.getDocument(id);
    } catch (error) {
      if (error instanceof MemberAppServiceError && error.code === "http" && error.status === 404) notFound();
      loadError = true;
    }
  }
  return <AdminShell role={membership.role} title={document ? "Edit member document" : "Member document"} intro="Update the private document details and availability.">
    <Link href="/admin/member-documents" className="mt-4 inline-block text-sm font-semibold text-swcu-blue">← Member Documents</Link>
    {!client ? <div className="mt-5"><MemberServiceNotice /></div> : loadError ? <MemberServiceLoadError /> : !document ? <MemberServiceLoadError /> : <div className="mt-5">{confirmation.saved === "1" && <p role="status" className="mb-4 rounded-lg border border-ocean-teal/20 bg-ocean-teal/5 p-3 text-sm font-semibold text-deep-navy">Document changes saved. The values below were reloaded from the Member App.</p>}<MemberDocumentEditor document={document} connected action={saveMemberDocumentAction} /></div>}
  </AdminShell>;
}