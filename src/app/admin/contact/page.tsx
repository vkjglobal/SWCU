import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { saveContactSettings } from "../actions";

export default async function ContactAdminPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? ""); await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const contact = await db.contactSettings.findUnique({ where: { tenantId: tenant.id } });
  return <main className="min-h-screen bg-soft-blue-grey"><div className="site-container py-12"><a href="/admin" className="text-sm font-semibold text-swcu-blue">← Dashboard</a><h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Contact Details</h1><form action={saveContactSettings} className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 sm:grid-cols-2">{[["organisationName","Organisation name"],["streetAddress","Street address"],["postalAddress","Postal address"],["telephone","Telephone"],["publicEmail","Public email"],["officeHours","Office hours (optional)"],["directionsUrl","Directions URL (optional)"]].map(([name,label])=><label key={name} className="text-sm font-semibold">{label}<input name={name} defaultValue={contact?.[name as keyof typeof contact] as string ?? ""} type={name==="publicEmail"?"email":name==="directionsUrl"?"url":"text"} className="mt-1 w-full rounded border p-2"/></label>)}<button className="w-fit rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save contact details</button></form></div></main>;
}