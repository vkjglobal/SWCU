import Link from "next/link";
import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { openContactEnquiry } from "@/lib/contact";
import { updateContactEnquiryAction } from "../../actions";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";

export default async function ContactEnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { session } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const { id } = await params;
  const enquiry = await openContactEnquiry({ tenant, actorUserId: session.user.id, id });
  return <main className="site-container py-12"><Link href="/admin/contact-enquiries" className="text-sm font-semibold text-swcu-blue">← Contact enquiries</Link><h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">{enquiry.reference}</h1><dl className="mt-8 max-w-3xl space-y-3 rounded-card bg-white p-6"><div><dt className="font-semibold">Subject</dt><dd>{enquiry.subject}</dd></div><div><dt className="font-semibold">Name</dt><dd>{enquiry.name}</dd></div><div><dt className="font-semibold">Email</dt><dd>{enquiry.email}</dd></div><div><dt className="font-semibold">Phone</dt><dd>{enquiry.phone ?? "Not provided"}</dd></div><div><dt className="font-semibold">Message</dt><dd className="whitespace-pre-wrap">{enquiry.message}</dd></div><div><dt className="font-semibold">Staff workflow</dt><dd><AdminActionForm action={updateContactEnquiryAction} successMessage="Enquiry update saved." className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="id" value={enquiry.id} /><select name="status" defaultValue={enquiry.status} className="rounded border p-2"><option value="NEW">New</option><option value="BEING_HANDLED">Being handled</option><option value="CLOSED">Closed</option></select><input name="note" defaultValue={enquiry.internalNote ?? ""} placeholder="Internal note" className="rounded border p-2" /><AdminSubmitButton pendingLabel="Saving…" className="rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save update</AdminSubmitButton></AdminActionForm></dd></div></dl></main>;
}