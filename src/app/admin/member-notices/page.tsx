import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient } from "@/lib/member-app-admin";
import { memberAudiences, noticeStatuses, type MemberNotice } from "@/lib/member-app-admin-contract";
import { AdminShell } from "../admin-shell";
import { MemberServiceBadge, MemberServiceLoadError, MemberServiceNotice, MemberSummaryText } from "@/components/member-services-ui";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-FJ", { timeZone: "Pacific/Fiji" }) : "—";
}

const pageSize = 25;
export default async function MemberNoticesPage({ searchParams }: { searchParams: Promise<{ status?: string; audience?: string; search?: string; page?: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const filters = await searchParams;
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  let result: { notices: MemberNotice[]; page: number; pageSize: number; total: number } | null = null;
  let loadError = false;
  if (client) {
    try {
      result = await client.listNotices({
        ...(noticeStatuses.includes(filters.status as (typeof noticeStatuses)[number]) ? { status: filters.status as (typeof noticeStatuses)[number] } : {}),
        ...(memberAudiences.includes(filters.audience as (typeof memberAudiences)[number]) ? { audience: filters.audience as (typeof memberAudiences)[number] } : {}),
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        page: requestedPage,
        pageSize,
      });
    } catch {
      loadError = true;
    }
  }
  const notices = result?.notices ?? [];
  const currentPage = result?.page ?? requestedPage;
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const pageHref = (page: number) => `/admin/member-notices?${new URLSearchParams({ ...(filters.status ? { status: filters.status } : {}), ...(filters.audience ? { audience: filters.audience } : {}), ...(filters.search ? { search: filters.search } : {}), page: String(page) })}`;
  return <AdminShell role={membership.role} title="Member Notices" intro="Share private updates with all members or one selected member.">
    {client && <div className="mt-5 flex justify-end"><Link href="/admin/member-notices/new" className="button-primary">Create notice</Link></div>}
    {!client ? <div className="mt-8"><MemberServiceNotice /></div> : loadError ? <MemberServiceLoadError message="We could not load Member Notices. Please try again." /> : <>
    <form method="get" className="mt-6 grid gap-3 rounded-card border border-deep-navy/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
      <label className="grid gap-1 text-sm font-semibold">Search<input name="search" defaultValue={filters.search} maxLength={120} className="rounded-lg border border-deep-navy/15 px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue" /></label>
      <label className="grid gap-1 text-sm font-semibold">Status<select name="status" defaultValue={filters.status ?? ""} className="rounded-lg border border-deep-navy/15 bg-white px-3 py-2 font-normal"><option value="">All statuses</option>{noticeStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Audience<select name="audience" defaultValue={filters.audience ?? ""} className="rounded-lg border border-deep-navy/15 bg-white px-3 py-2 font-normal"><option value="">All audiences</option>{memberAudiences.map((audience) => <option key={audience}>{audience}</option>)}</select></label>
      <input type="hidden" name="page" value="1" /><button className="button-primary" type="submit">Filter</button>
    </form>
    <section className="mt-6 overflow-hidden rounded-card border border-deep-navy/10 bg-white shadow-card">
      <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-deep-navy/10 bg-soft-blue-grey px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal/65 lg:grid"><span>Title</span><span>Audience</span><span>Show from</span><span>Show until</span><span>Status / Updated</span><span className="sr-only">Action</span></div>
      {notices.length === 0 ? <p className="p-6 text-charcoal/70">No member notices have been created.</p> : <div className="divide-y divide-deep-navy/10">{notices.map((notice) => <div key={notice.id} className="grid gap-3 px-5 py-4 text-sm lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4">
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 lg:hidden">Title</span><strong>{notice.title}</strong>{notice.attachment && <a href={`/api/admin/member-notices/${encodeURIComponent(notice.id)}/attachment`} className="mt-1 block font-semibold text-swcu-blue underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue">Open attachment: {notice.attachment.name}</a>}</div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 lg:hidden">Audience</span><MemberSummaryText member={notice.member} /></div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 lg:hidden">Show from</span>{dateLabel(notice.showFrom)}</div>
        <div><span className="block text-xs font-bold uppercase text-charcoal/55 lg:hidden">Show until</span>{dateLabel(notice.showUntil)}</div>
        <div className="grid justify-items-start gap-1"><MemberServiceBadge status={notice.status} /><span className="text-xs text-charcoal/60">Updated {dateLabel(notice.updatedAt)}</span></div>
        <Link href={`/admin/member-notices/${encodeURIComponent(notice.id)}`} className="font-semibold text-swcu-blue underline">Edit</Link>
      </div>)}</div>}
    </section>
    {result && <nav aria-label="Notice pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Page {currentPage} of {pages} · {result.total} notices</span><div className="flex gap-2">{currentPage > 1 && <Link className="rounded-lg border border-deep-navy/15 px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue" href={pageHref(currentPage - 1)}>Previous</Link>}{currentPage < pages && <Link className="rounded-lg border border-deep-navy/15 px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue" href={pageHref(currentPage + 1)}>Next</Link>}</div></nav>}
    </>}
  </AdminShell>;
}