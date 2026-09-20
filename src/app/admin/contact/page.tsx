import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveContactSettings, replaceContactMap, removeContactMap } from "../actions";
import { AdminMediaUpload, ConfirmSubmitButton } from "@/components/admin-media-upload";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";

export default async function ContactAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const contact = await db.contactSettings.findUnique({ where: { tenantId: tenant.id } });
  const notificationReady = Boolean(contact?.notificationRecipients && process.env.RESEND_API_KEY && process.env.CONTACT_EMAIL_FROM);
  const fields = [["organisationName", "Organisation name"], ["streetAddress", "Street address"], ["postalAddress", "Postal address"], ["telephone", "Telephone"], ["publicEmail", "Public email"], ["officeHours", "Office hours (optional)"], ["notificationRecipients", "Notification recipients (comma-separated Administrator emails)"]];
  return <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12">
    <Link href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Contact Details</h1>
      <AdminActionForm action={saveContactSettings} className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 sm:grid-cols-2" successMessage="Contact details saved.">
      {fields.map(([name, label]) => <label key={name} className="text-sm font-semibold">{label}<input name={name} defaultValue={contact?.[name as keyof typeof contact] as string ?? ""} type={name === "publicEmail" ? "email" : name === "directionsUrl" ? "url" : "text"} className="mt-1 w-full rounded border p-2" /></label>)}
      <AdminSubmitButton pendingLabel="Saving…" className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save contact details</AdminSubmitButton>
       <p className="text-sm text-charcoal/70 sm:col-span-2">{notificationReady ? "Email notification delivery is configured. Enquiries are saved to the inbox before notification is attempted." : "Email notification delivery is not fully configured. Enquiries are still saved to the inbox; website submissions do not depend on notification delivery."}</p>
    </AdminActionForm>
      <section className="mt-6 max-w-3xl rounded-card bg-white p-6"><h2 className="font-heading text-2xl font-bold text-deep-navy">Contact Map</h2><p className="mt-2 text-sm text-charcoal/70">Upload the static map image used on the public Contact page.</p>{contact?.contactMapMediaAssetId ? <div className="mt-4 flex flex-wrap items-start gap-4"><img src={`/api/media/${contact.contactMapMediaAssetId}`} alt="Current Contact Map" className="h-36 w-56 rounded-lg object-cover" /><div><p className="font-semibold text-ocean-teal">Map image uploaded</p><a className="mt-2 inline-block text-sm font-semibold text-swcu-blue underline" href={`/api/media/${contact.contactMapMediaAssetId}`} target="_blank" rel="noreferrer">Preview map</a></div></div> : <p className="mt-4 text-sm font-semibold text-charcoal/65">No map image uploaded.</p>}<div className="mt-5"><AdminMediaUpload action={replaceContactMap} buttonLabel={contact?.contactMapMediaAssetId ? "Replace map" : "Upload map"}><input type="hidden" name="expectedMediaId" value={contact?.contactMapMediaAssetId ?? ""} /></AdminMediaUpload></div>{contact?.contactMapMediaAssetId && <AdminActionForm action={removeContactMap} className="mt-4" successMessage="Contact Map removed."><input type="hidden" name="expectedMediaId" value={contact.contactMapMediaAssetId} /><ConfirmSubmitButton label="Remove map" message="Remove the current Contact Map image?" /></AdminActionForm>}</section>
     <section className="mt-6 max-w-3xl rounded-card border border-deep-navy/10 bg-white p-6"><h2 className="font-heading text-xl font-bold text-deep-navy">Contact Enquiries</h2><p className="mt-2 text-sm text-charcoal/70">Day-to-day messages are managed in their protected work area.</p><Link href="/admin/contact-enquiries" className="mt-4 inline-block rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Open Contact Enquiries</Link></section>
  </div></main>;
}