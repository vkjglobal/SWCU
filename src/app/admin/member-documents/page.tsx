import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient } from "@/lib/member-app-admin";
import type { MemberDocument } from "@/lib/member-app-admin-contract";
import { AdminShell } from "../admin-shell";
import { MemberServiceBadge, MemberServiceNotice, MemberSummaryText } from "@/components/member-services-ui";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-FJ", { timeZone: "Pacific/Fiji" }) : "—";
}

export default async function MemberDocumentsPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  let documents: MemberDocument[] = [];
  if (client) documents = await client.listDocuments();
  documents.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return <AdminShell role={membership.role} title="Member Documents" intro="Manage private documents available only to signed-in members.">
    {client && <div className="mt-5 flex justify-end"><Link href="/admin/member-documents/new" className="button-primary">Add document</Link></div>}
    {!client ? <div className="mt-8"><MemberServiceNotice /></div> : <section className="mt-6 overflow-hidden rounded-card border border-deep-navy/10 bg-white shadow-card">
      <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-deep-navy/10 bg-soft-blue-grey px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal/65 md:grid"><span>Title</span><span>Audience</span><span>Type</span><span>Available from</span><span>Expiry</span><span>Status / Updated</span><span className="sr-only">Action</span></div>
      {documents.length === 0 ? <p className="p-6 text-charcoal/70">No member documents have been added.</p> : <div className="divide-y divide-deep-navy/10">{documents.map((document) => <div key={document.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Title</span><strong>{document.title}</strong></div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Audience</span><MemberSummaryText member={document.member} /></div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Type</span>{document.documentType}</div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Available from</span>{dateLabel(document.availableFrom)}</div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Expiry</span>{dateLabel(document.availableUntil)}</div>
        <div className="grid justify-items-start gap-1"><MemberServiceBadge status={document.status} /><span className="text-xs text-charcoal/60">Updated {dateLabel(document.updatedAt)}</span></div>
        <Link href={`/admin/member-documents/${encodeURIComponent(document.id)}`} className="font-semibold text-swcu-blue underline">Edit</Link>
      </div>)}</div>}
    </section>}
  </AdminShell>;
}