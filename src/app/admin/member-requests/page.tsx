import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { getMemberAppAdminClient, MemberAppServiceError } from "@/lib/member-app-admin";
import { requestStatuses, type MemberRequestSummary } from "@/lib/member-app-admin-contract";
import { AdminShell } from "../admin-shell";
import { MemberServiceBadge, MemberServiceLoadError, MemberServiceNotice } from "@/components/member-services-ui";

const formCodes = ["LOAN_APPLICATION", "INCREASE_REPAYMENT_SAVINGS", "FULL_WITHDRAWAL", "PARTIAL_WITHDRAWAL", "UPDATE_DETAILS"];
const pageSize = 25;

export default async function MemberRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; search?: string; page?: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership, session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const filters = await searchParams;
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  let result: { requests: MemberRequestSummary[]; page: number; pageSize: number; total: number } | null = null;
  let loadError = false;
  let loadCode: string | null = null;
  if (client) {
    try {
      result = await client.listRequests({
        ...(requestStatuses.includes(filters.status as (typeof requestStatuses)[number]) ? { status: filters.status as (typeof requestStatuses)[number] } : {}),
        ...(formCodes.includes(filters.type ?? "") ? { formCode: filters.type } : {}),
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        page: requestedPage,
        pageSize,
      });
    } catch (error) {
      loadError = true;
      loadCode = error instanceof MemberAppServiceError ? `${error.code}:${error.status ?? "none"}` : "unexpected";
    }
  }
  const visible = result?.requests ?? [];
  if (process.env.NODE_ENV === "development") {
    console.info("[member-requests-dev-check]", {
      tenant: tenant.slug,
      connected: Boolean(client),
      total: result?.total ?? null,
      visible: visible.length,
      loadError,
      loadCode,
      page: requestedPage,
      filtered: Boolean(filters.search || filters.status || filters.type),
    });
  }
  const currentPage = result?.page ?? requestedPage;
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return <AdminShell role={membership.role} title="Member Requests" intro="Review and manage requests submitted by members.">
    {!client ? <div className="mt-8"><MemberServiceNotice /></div> : loadError ? <MemberServiceLoadError message="We could not load Member Requests. Please try again." /> : <>
      <form method="get" className="mt-7 grid gap-3 rounded-card border border-deep-navy/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
        <label className="grid gap-1 text-sm font-semibold">Search<input name="search" defaultValue={filters.search} placeholder="Reference or member" className="rounded-lg border border-deep-navy/15 px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue" /></label>
        <label className="grid gap-1 text-sm font-semibold">Status<select name="status" defaultValue={filters.status ?? ""} className="rounded-lg border border-deep-navy/15 bg-white px-3 py-2 font-normal"><option value="">All statuses</option>{requestStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Request type<select name="type" defaultValue={filters.type ?? ""} className="rounded-lg border border-deep-navy/15 bg-white px-3 py-2 font-normal"><option value="">All types</option>{formCodes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <input type="hidden" name="page" value="1" />
        <button className="button-primary" type="submit">Filter</button>
      </form>
      <section className="mt-6 overflow-hidden rounded-card border border-deep-navy/10 bg-white shadow-card">
        <div className="hidden grid-cols-[1fr_1.3fr_1fr_1fr_1fr_auto] gap-4 border-b border-deep-navy/10 bg-soft-blue-grey px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal/65 md:grid"><span>Reference</span><span>Member</span><span>Request type</span><span>Submitted</span><span>Status / Updated</span><span className="sr-only">Action</span></div>
        {visible.length === 0 ? <p className="p-6 text-charcoal/70">No member requests match these filters.</p> : <div className="divide-y divide-deep-navy/10">{visible.map((item) => <div key={item.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_1.3fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
          <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Reference</span><strong>{item.reference}</strong></div>
         <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Member</span>{item.member.name}<span className="block text-xs text-charcoal/60">{item.member.identifier}</span></div>
         <div><span className="block text-xs font-bold uppercase text-charcoal/55 md:hidden">Request type</span>{item.type}</div>
          <time className="text-charcoal/70">{new Date(item.submittedAt).toLocaleString("en-FJ", { timeZone: "Pacific/Fiji" })}</time>
          <div className="grid justify-items-start gap-1"><MemberServiceBadge status={item.status} /><span className="text-xs text-charcoal/60">Updated {new Date(item.updatedAt).toLocaleDateString("en-FJ", { timeZone: "Pacific/Fiji" })}</span></div>
          <Link href={`/admin/member-requests/${encodeURIComponent(item.id)}`} className="font-semibold text-swcu-blue underline">Open</Link>
        </div>)}</div>}
      </section>
       {result && <nav aria-label="Request pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
         <span>Page {currentPage} of {pages} · {result.total} requests</span>
         <div className="flex gap-2">
           {currentPage > 1 && <Link className="rounded-lg border border-deep-navy/15 px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue" href={`/admin/member-requests?${new URLSearchParams({ ...(filters.status ? { status: filters.status } : {}), ...(filters.type ? { type: filters.type } : {}), ...(filters.search ? { search: filters.search } : {}), page: String(currentPage - 1) })}`}>Previous</Link>}
           {currentPage < pages && <Link className="rounded-lg border border-deep-navy/15 px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-swcu-blue" href={`/admin/member-requests?${new URLSearchParams({ ...(filters.status ? { status: filters.status } : {}), ...(filters.type ? { type: filters.type } : {}), ...(filters.search ? { search: filters.search } : {}), page: String(currentPage + 1) })}`}>Next</Link>}
         </div>
       </nav>}
    </>}
  </AdminShell>;
}