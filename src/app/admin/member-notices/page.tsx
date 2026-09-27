import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient } from "@/lib/member-app-admin";
import type { MemberNotice } from "@/lib/member-app-admin-contract";
import { AdminShell } from "../admin-shell";
import { MemberServiceBadge, MemberServiceNotice, MemberSummaryText } from "@/components/member-services-ui";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-FJ", { timeZone: "Pacific/Fiji" }) : "—";
}

export default async function MemberNoticesPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  let notices: MemberNotice[] = [];
  if (client) notices = await client.listNotices();
  notices.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return <AdminShell role={membership.role} title="Member Notices" intro="Share private updates with all members or one selected member.">
    {client && <div className="mt-5 flex justify-end"><Link href="/admin/member-notices/new" className="button-primary">Create notice</Link></div>}
    {!client ? <div className="mt-8"><MemberServiceNotice /></div> : <section className="mt-6 overflow-hidden rounded-card border border-deep-navy/10 bg-white shadow-card">
      <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-deep-navy/10 bg-soft-blue-grey px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal/65 md:grid"><span>Title</span><span>Audience</span><span>Show from</span><span>Show until</span><span>Status</span><span className="sr-only">Action</span></div>
      {notices.length === 0 ? <p className="p-6 text-charcoal/70">No member notices have been created.</p> : <div className="divide-y divide-deep-navy/10">{notices.map((notice) => <div key={notice.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Title</span><strong>{notice.title}</strong></div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Audience</span><MemberSummaryText member={notice.member} /></div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Show from</span>{dateLabel(notice.showFrom)}</div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Show until</span>{dateLabel(notice.showUntil)}</div>
        <MemberServiceBadge status={notice.status} />
        <Link href={`/admin/member-notices/${encodeURIComponent(notice.id)}`} className="font-semibold text-swcu-blue underline">Edit</Link>
      </div>)}</div>}
    </section>}
  </AdminShell>;
}