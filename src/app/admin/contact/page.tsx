import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveContactSettings, updateContactEnquiryAction, replaceContactMap, removeContactMap } from "../actions";

export default async function ContactAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const contact = await db.contactSettings.findUnique({ where: { tenantId: tenant.id } });
  const enquiries = await db.contactSubmission.findMany({ where: { tenantId: tenant.id }, orderBy: { submittedAt: "desc" } });
  const newCount = enquiries.filter((item) => item.status === "NEW").length;
  const notificationReady = Boolean(contact?.notificationRecipients && process.env.RESEND_API_KEY && process.env.CONTACT_EMAIL_FROM);
  const fields = [["organisationName", "Organisation name"], ["streetAddress", "Street address"], ["postalAddress", "Postal address"], ["telephone", "Telephone"], ["publicEmail", "Public email"], ["officeHours", "Office hours (optional)"], ["directionsUrl", "Directions URL (optional)"], ["notificationRecipients", "Notification recipients (comma-separated Administrator emails)"]];
  return <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12">
    <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Contact Details</h1>
    <form action={saveContactSettings} className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 sm:grid-cols-2">
      {fields.map(([name, label]) => <label key={name} className="text-sm font-semibold">{label}<input name={name} defaultValue={contact?.[name as keyof typeof contact] as string ?? ""} type={name === "publicEmail" ? "email" : name === "directionsUrl" ? "url" : "text"} className="mt-1 w-full rounded border p-2" /></label>)}
      <button className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save contact details</button>
    </form>
    <section className="mt-6 max-w-3xl rounded-card bg-white p-6"><h2 className="font-heading text-2xl font-bold text-deep-navy">Contact Map</h2><p className="mt-2 text-sm text-charcoal/70">Upload a static map image for the public Contact page. The image is served through the SWCU media system.</p>{contact?.contactMapMediaAssetId && <p className="mt-2 text-sm font-semibold text-ocean-teal">A Contact Map image is currently active. <a className="text-swcu-blue underline" href={`/api/media/${contact.contactMapMediaAssetId}`} target="_blank" rel="noreferrer">Preview</a></p>}<form action={replaceContactMap} className="mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="expectedMediaId" value={contact?.contactMapMediaAssetId ?? ""} /><label className="text-sm font-semibold">Map image<input required name="file" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" /></label><button className="rounded bg-swcu-blue px-4 py-2 font-semibold text-white">{contact?.contactMapMediaAssetId ? "Replace map" : "Upload map"}</button></form>{contact?.contactMapMediaAssetId && <form action={removeContactMap} className="mt-3"><input type="hidden" name="expectedMediaId" value={contact.contactMapMediaAssetId} /><button className="text-sm font-semibold text-swcu-red underline">Remove map</button></form>}</section>
    <p className="mt-3 max-w-3xl text-sm text-charcoal/70">{notificationReady ? "Email notification delivery is configured. Enquiries are saved to this inbox before notification is attempted; a delivery issue does not prevent submission." : "Email notification delivery is not fully configured. Enquiries are still saved to this inbox; website submissions do not depend on notification delivery."}</p>
    <section className="mt-10 max-w-4xl"><div className="flex items-baseline justify-between"><h2 className="font-heading text-2xl font-bold text-deep-navy">Contact enquiries</h2><span className="text-sm text-charcoal/70">{newCount} new</span></div>
      <div className="mt-4 space-y-4">{enquiries.length === 0 ? <p className="rounded-card bg-white p-6 text-charcoal/70">No enquiries have been received.</p> : enquiries.map((item) => <article key={item.id} className="rounded-card bg-white p-5">
        <div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-deep-navy">{item.reference} · {item.subject}</p><p className="text-sm text-charcoal/70">{item.name} · {item.email}{item.phone ? ` · ${item.phone}` : ""}</p></div><time className="text-sm text-charcoal/60">{item.submittedAt.toLocaleString()}</time></div>
        <Link prefetch={false} href={`/admin/contact-enquiries/${item.id}`} className="mt-3 inline-block text-sm font-semibold text-swcu-blue">Open enquiry</Link>
        <form action={updateContactEnquiryAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="id" value={item.id} /><select name="status" defaultValue={item.status} className="rounded border p-2"><option value="NEW">New</option><option value="BEING_HANDLED">Being handled</option><option value="CLOSED">Closed</option></select><input name="note" defaultValue={item.internalNote ?? ""} placeholder="Internal note" className="rounded border p-2" /><button className="rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save</button></form>
      </article>)}</div>
    </section>
  </div></main>;
}